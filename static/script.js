let map = L.map('map').setView([20.5937, 78.9629], 5);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

let routeLayer, pickupMarker, dropMarker;
let fareChartInstance = null;

async function getCoordinates(address) {
    let response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${address}`);
    let data = await response.json();
    return data.length ? [parseFloat(data[0].lat), parseFloat(data[0].lon)] : null;
}

async function getRouteDetails(pickupCoords, dropCoords) {
    let response = await fetch(`https://router.project-osrm.org/route/v1/driving/${pickupCoords[1]},${pickupCoords[0]};${dropCoords[1]},${dropCoords[0]}?overview=full&geometries=geojson`);
    let data = await response.json();
    if (data.routes.length > 0) {
        return { distance_km: (data.routes[0].distance / 1000).toFixed(2), route: data.routes[0].geometry };
    }
    return null;
}

async function calculateFare() {
    let pickup = document.getElementById("pickup").value;
    let drop = document.getElementById("drop").value;
    let rideType = document.getElementById("rideType").value;
    let passengers = document.getElementById("passengers").value;

    let pickupCoords = await getCoordinates(pickup);
    let dropCoords = await getCoordinates(drop);
    if (!pickupCoords || !dropCoords) { alert("Invalid address!"); return; }

    let routeDetails = await getRouteDetails(pickupCoords, dropCoords);
    if (!routeDetails) { alert("Unable to fetch route details!"); return; }

    let { distance_km, route } = routeDetails;

    if (routeLayer) { map.removeLayer(routeLayer); }
    if (pickupMarker) { map.removeLayer(pickupMarker); }
    if (dropMarker) { map.removeLayer(dropMarker); }

    routeLayer = L.geoJSON(route).addTo(map);
    map.fitBounds(routeLayer.getBounds());

    pickupMarker = L.marker(pickupCoords).addTo(map).bindPopup(`<b>Pickup:</b> ${pickup}`).openPopup();
    dropMarker = L.marker(dropCoords).addTo(map).bindPopup(`<b>Drop:</b> ${drop}`).openPopup();

    let baseFare = 50;
    let distanceFare = distance_km * 10;
    let passengerFare = passengers * 5;
    let totalFare = (baseFare + distanceFare + passengerFare).toFixed(2);

    document.getElementById("pickupAddress").innerText = pickup;
    document.getElementById("dropAddress").innerText = drop;
    document.getElementById("distance").innerText = distance_km;
    document.getElementById("selectedRideType").innerText = rideType;
    document.getElementById("numPassengers").innerText = passengers;
    document.getElementById("distanceFare").innerText = distanceFare.toFixed(2);
    document.getElementById("passengerFare").innerText = passengerFare.toFixed(2);
    document.getElementById("fare").innerText = totalFare;

    let row = `<tr><td>${pickup}</td><td>${drop}</td><td>${distance_km}</td><td>${totalFare}</td></tr>`;
    document.getElementById("historyTable").innerHTML += row;

    updateChart();

    // --- Save Ride in Flask Database ---
    let rideData = {
        pickup: pickup,
        drop: drop,
        distance: distance_km,
        fare: totalFare,
        ride_type: rideType,
        passengers: passengers
    };
    fetch("/add_ride", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rideData)
    })
    .then(res => res.json())
    .then(data => console.log(data.message));
}

function updateChart() {
    let rows = document.querySelectorAll("#historyTable tr");
    let labels = [], fares = [];

    for (let i = 1; i < rows.length; i++) {
        labels.push(`Ride ${i}`);
        fares.push(parseFloat(rows[i].cells[3].innerText));
    }

    let ctx = document.getElementById("fareChart").getContext("2d");

    if (fareChartInstance) { fareChartInstance.destroy(); }

    fareChartInstance = new Chart(ctx, {
        type: "line",
        data: {
            labels: labels,
            datasets: [{
                label: "Fare (₹)",
                data: fares,
                borderColor: "blue",
                backgroundColor: "rgba(0, 123, 255, 0.2)",
                fill: true,
                tension: 0.1
            }]
        }
    });
}
function searchLocation(type) {
    let input = document.getElementById(type).value;
    let suggestionBox = document.getElementById(type + "Suggestions");

    if (input.length < 2) {
        suggestionBox.innerHTML = "";
        return;
    }

    fetch(`/search?q=${input}`)
        .then(res => res.json())
        .then(locations => {
            suggestionBox.innerHTML = "";
            locations.forEach(loc => {
                let div = document.createElement("div");
                div.innerText = loc;
                div.onclick = () => {
                    document.getElementById(type).value = loc;
                    suggestionBox.innerHTML = "";
                };
                suggestionBox.appendChild(div);
            });
        });
}

// --- Load Ride History from Database on page load ---
window.onload = function() {
    fetch("/history")
    .then(res => res.json())
    .then(rides => {
        rides.forEach(r => {
            let row = `<tr>
                <td>${r.pickup}</td>
                <td>${r.drop}</td>
                <td>${r.distance}</td>
                <td>${r.fare}</td>
            </tr>`;
            document.getElementById("historyTable").innerHTML += row;
        });
        updateChart();
    });
};
