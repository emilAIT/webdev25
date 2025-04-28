// static/crypto.js

export async function openDatabase() {
    return await idb.openDB("keyDatabase", 1, {
        upgrade(db) {
            db.createObjectStore("keys");
        },
    });
}

export async function hasKeys() {
    const db = await openDatabase();
    const tx = db.transaction("keys", "readonly");
    const store = tx.objectStore("keys");
    const privateKey = await store.get("privateKey");
    return !!privateKey;
}

export async function generateKeyPair() {
    const keyPair = await window.crypto.subtle.generateKey(
        {
            name: "RSA-OAEP",
            modulusLength: 2048,
            publicExponent: new Uint8Array([1, 0, 1]),
            hash: "SHA-256",
        },
        true,
        ["encrypt", "decrypt"]
    );

    const db = await openDatabase();
    const tx = db.transaction("keys", "readwrite");
    const store = tx.objectStore("keys");
    await store.put(keyPair.privateKey, "privateKey");
    await store.put(keyPair.publicKey, "publicKey");
    await tx.done;
}

export async function exportPublicKey() {
    const db = await openDatabase();
    const tx = db.transaction("keys", "readonly");
    const store = tx.objectStore("keys");
    const publicKey = await store.get("publicKey");
    const exportedKey = await window.crypto.subtle.exportKey("jwk", publicKey);

    await fetch("/auth/upload_public_key", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ publicKey: exportedKey }),
    });
}
