/**
 * TogolokChat Language Manager
 * Handles loading and applying language translations throughout the application
 */

class LanguageManager {
    constructor() {
        this.currentLanguage = localStorage.getItem('togolok_language') || 'en';
        this.translations = {};
        this.elements = [];
        this.initialized = false;
        this.dynamicElements = new Map(); // Store dynamically created elements
    }

    /**
     * Initialize the language manager
     */
    async init() {
        await this.loadLanguage(this.currentLanguage);
        this.setupMutationObserver();
        this.applyTranslations();
        this.initialized = true;
        
        // Log initialization
        console.log(`Language manager initialized with language: ${this.currentLanguage}`);
    }

    /**
     * Setup mutation observer to detect new elements added to the DOM
     */
    setupMutationObserver() {
        // Create a MutationObserver to watch for new elements with data-i18n attributes
        const observer = new MutationObserver(mutations => {
            let needsTranslation = false;
            
            mutations.forEach(mutation => {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            // Check if the added node or any of its children have data-i18n attributes
                            if (node.hasAttribute && node.hasAttribute('data-i18n')) {
                                needsTranslation = true;
                            }
                            
                            const translatableElements = node.querySelectorAll('[data-i18n], [data-i18n-placeholder]');
                            if (translatableElements.length > 0) {
                                needsTranslation = true;
                            }
                        }
                    });
                }
            });
            
            if (needsTranslation) {
                this.applyTranslations();
            }
        });
        
        // Start observing the document with the configured parameters
        observer.observe(document.body, { childList: true, subtree: true });
        console.log('Mutation observer set up for dynamic translations');
    }

    /**
     * Load a language file
     * @param {string} lang - Language code (en, ru, ky)
     */
    async loadLanguage(lang) {
        try {
            const response = await fetch(`/languages/${lang}.json`);
            if (!response.ok) {
                throw new Error(`Failed to load language file: ${lang}.json`);
            }
            this.translations = await response.json();
            this.currentLanguage = lang;
            localStorage.setItem('togolok_language', lang);
            console.log(`Language loaded: ${lang}`);
            return true;
        } catch (error) {
            console.error('Error loading language:', error);
            // Fall back to English if there's an error
            if (lang !== 'en') {
                return this.loadLanguage('en');
            }
            return false;
        }
    }

    /**
     * Change the application language
     * @param {string} lang - Language code to change to
     */
    async changeLanguage(lang) {
        if (lang === this.currentLanguage) return;
        
        const success = await this.loadLanguage(lang);
        if (success) {
            this.applyTranslations();
            this.updateDynamicContent();
            
            // Dispatch event for other components to react
            window.dispatchEvent(new CustomEvent('languageChanged', { 
                detail: { language: lang } 
            }));
            return true;
        }
        return false;
    }

    /**
     * Update dynamic content that might not have data-i18n attributes
     */
    updateDynamicContent() {
        // Update document title
        if (document.title) {
            const titleElement = document.querySelector('title');
            if (titleElement && titleElement.getAttribute('data-i18n')) {
                document.title = this.translate(titleElement.getAttribute('data-i18n'));
            }
        }
        
        // Update any custom elements or components
        this.dynamicElements.forEach((key, element) => {
            if (element && document.contains(element)) {
                element.textContent = this.translate(key);
            } else {
                // Clean up references to elements that no longer exist
                this.dynamicElements.delete(element);
            }
        });
    }

    /**
     * Register a dynamic element for translation updates
     * @param {HTMLElement} element - The element to update
     * @param {string} key - The translation key
     */
    registerDynamicElement(element, key) {
        this.dynamicElements.set(element, key);
        element.textContent = this.translate(key);
    }

    /**
     * Get a translation by key
     * @param {string} key - Dot notation path to translation (e.g., "chat.send")
     * @param {object} params - Optional parameters for string interpolation
     * @returns {string} - Translated text or key if not found
     */
    translate(key, params = {}) {
        // Split the key by dots to navigate the translations object
        const path = key.split('.');
        let translation = this.translations;
        
        // Navigate through the translations object
        for (const segment of path) {
            if (translation && translation[segment]) {
                translation = translation[segment];
            } else {
                console.warn(`Translation not found for key: ${key}`);
                return key; // Return the key if translation not found
            }
        }
        
        // If we have a string, return it with params replaced
        if (typeof translation === 'string') {
            // Replace parameters in the format {{paramName}}
            return translation.replace(/\{\{(\w+)\}\}/g, (match, param) => {
                return params[param] !== undefined ? params[param] : match;
            });
        }
        
        // If we have an object or array, return the key
        return key;
    }

    /**
     * Apply translations to all elements with data-i18n attribute
     */
    applyTranslations() {
        // Find all elements with data-i18n attribute
        const elements = document.querySelectorAll('[data-i18n]');
        
        elements.forEach(element => {
            const key = element.getAttribute('data-i18n');
            const translation = this.translate(key);
            
            // Check if we need to update an attribute or the content
            if (key.includes(':')) {
                const [attr, attrKey] = key.split(':');
                element.setAttribute(attr, this.translate(attrKey));
            } else {
                element.textContent = translation;
            }
        });
        
        // Update placeholders
        document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
            const key = element.getAttribute('data-i18n-placeholder');
            element.placeholder = this.translate(key);
        });
        
        // Update buttons with data-i18n-value
        document.querySelectorAll('[data-i18n-value]').forEach(element => {
            const key = element.getAttribute('data-i18n-value');
            element.value = this.translate(key);
        });
        
        // Update elements with data-i18n-title
        document.querySelectorAll('[data-i18n-title]').forEach(element => {
            const key = element.getAttribute('data-i18n-title');
            element.title = this.translate(key);
        });
        
        // Update dynamic content
        this.updateDynamicContent();
        
        console.log(`Applied translations to ${elements.length} elements`);
    }
}

// Create a global instance
window.languageManager = new LanguageManager();

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.languageManager.init();
});
