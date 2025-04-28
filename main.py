
from flask import Flask, request, render_template, jsonify
from flask_cors import CORS
from random import randint
from collections import defaultdict
app = Flask(__name__)
CORS(app)


d = {
    "correct": 0, 
    "attempt": 0, 
    "question": "", 
    "incorrect": 0,
    "question_count": 0
}

ops = "+-"

@app.route("/")
def enterance():
    return render_template("math.html")

@app.route("/get_question")
def generate_question():
    try:
        first = randint(0, 100)
        second = randint(0, 100)
        first, second = max(first, second), min(first, second)
        op = ops[randint(0, 1)]
        d["question"] = f'{first}{op}{second}'
        d["question_count"] += 1
        return jsonify({"question": d["question"]})
    except:
        return "ERROR IN THE SERVER"

@app.route('/check_result')
def check_result():
    try:
        answer = int(request.args.get("answer"))
        d["attempt"] += 1
        if answer == eval(d["question"]):
            d["correct"] += 1
        else:
            d["incorrect"] += 1
        return jsonify(d)   
    except:
        return "error in the server"


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080)



    
