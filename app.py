from flask import Flask, render_template, request, jsonify
from flask_sqlalchemy import SQLAlchemy

app = Flask(__name__)

# Database configuration (SQLite)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///rides.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# Ride Model
class Ride(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    pickup = db.Column(db.String(200), nullable=False)
    drop = db.Column(db.String(200), nullable=False)
    distance = db.Column(db.Float, nullable=False)
    fare = db.Column(db.Float, nullable=False)
    ride_type = db.Column(db.String(50), nullable=False)
    passengers = db.Column(db.Integer, nullable=False)

# Create database tables
with app.app_context():
    db.create_all()

# Home Page
@app.route("/")
def home():
    return render_template("index.html")

# Save a new ride
@app.route("/add_ride", methods=["POST"])
def add_ride():
    data = request.json
    new_ride = Ride(
        pickup=data["pickup"],
        drop=data["drop"],
        distance=float(data["distance"]),
        fare=float(data["fare"]),
        ride_type=data["ride_type"],
        passengers=int(data["passengers"])
    )
    db.session.add(new_ride)
    db.session.commit()
    return jsonify({"message": "Ride saved successfully!"})

# Fetch ride history
@app.route("/history", methods=["GET"])
def history():
    rides = Ride.query.all()
    ride_list = [
        {
            "pickup": r.pickup,
            "drop": r.drop,
            "distance": r.distance,
            "fare": r.fare,
            "ride_type": r.ride_type,
            "passengers": r.passengers
        }
        for r in rides
    ]
    return jsonify(ride_list)
@app.route("/search")
def search():
    query = request.args.get("q", "").lower()
    results = []
    if query:
        rides = Ride.query.filter(
            (Ride.pickup.ilike(f"%{query}%")) | (Ride.drop.ilike(f"%{query}%"))
        ).all()
        # Collect unique location names
        seen = set()
        for r in rides:
            if query in r.pickup.lower() and r.pickup not in seen:
                results.append(r.pickup)
                seen.add(r.pickup)
            if query in r.drop.lower() and r.drop not in seen:
                results.append(r.drop)
                seen.add(r.drop)
    return jsonify(results)

if __name__ == "__main__":
    app.run(debug=True)
