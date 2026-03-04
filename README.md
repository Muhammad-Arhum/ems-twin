# Transformer Digital Twin

This is an **OpenSource testing project** designed to simulate power transformer behavior in real-time. It provides a digital twin interface for electrical engineers and students to analyze transformer parameters, visualize voltage/current relationships, and calculate efficiency.

---

## 🚀 Purpose

We are building this to simplify transformer analysis and provide an interactive tool for EMS (Energy Management Systems) research.

---

## 🛠 Features

- **Dynamic Calculations**: Real-time updates as you change any parameter.
- **Inference Engine**: Automatically detects and computes missing values based on available inputs.
- **Visual Analytics**: Interactive charts showing Primary vs Secondary balance.
- **Practical Modeling**: Toggle between Ideal and Practical models (including winding resistance and magnetizing current).
- **Realtime Mode**: Connect your own Firebase Realtime Database to stream live transformer sensor data.

---

## ⚙️ Hardware Setup (ESP32 + Sensors)

To enable real-time hardware integration, you can use the following components:

### 🔌 Components Required

| Component                 | Description                            |
|---------------------------|----------------------------------------|
| ESP32 Dev Board           | WiFi-enabled microcontroller           |
| ZMPT101B Voltage Sensor   | Measures AC voltage (Vp, Vs)           |
| ACS712 Current Sensor     | Measures current (Ip, Is)              |
| Transformer               | Your physical test transformer         |
| Resistors, breadboard     | For load and wiring                    |

### 🖥 Pin Mapping (ESP32 Example)

| Signal            | Sensor       | ESP32 Pin |
|------------------|--------------|-----------|
| Primary Voltage   | ZMPT101B     | GPIO34    |
| Secondary Voltage | ZMPT101B     | GPIO35    |
| Primary Current   | ACS712       | GPIO32    |
| Secondary Current | ACS712       | GPIO33    |

> ⚠️ Use voltage dividers or isolation modules as needed. Always ensure safety when working with AC voltages.


## 🌐 Firebase Configuration (Realtime Mode)

To use the **Realtime Processing** feature, you must set up your own Firebase Realtime Database and input credentials into the app.

### 🔐 Required Fields (from Firebase Console)

- `apiKey`
- `projectId`
- `databaseURL`

These are used **only on the client side**, and **not stored** anywhere.

### 🔁 Database Path

The app listens at:

```

/transformer/live

````

### ✅ Firebase Rules (Recommended for Testing Only)

```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
````

> ⚠️ **Important**: You are responsible for securing your database if used in production or publicly.

---

## 📊 Real-time Data Schema

If you're using Realtime Mode, your database should send data in the following format:

```json
{
  "vp": 240,       // Primary Voltage (V)
  "vs": 120,       // Secondary Voltage (V)
  "ip": 5,         // Primary Current (A)
  "is": 10,        // Secondary Current (A)
  "np": 1000,      // Primary Turns
  "ns": 500,       // Secondary Turns
  "zl": 12,        // Load Impedance (Ω)
  "phi": 0,        // Phase Angle (°)
  "rw": 0.5,       // Winding Resistance (Ω)
  "xm": 500        // Magnetizing Reactance (Ω)
}
```

> [!NOTE]
> All fields are optional. The Digital Twin will infer missing values using transformer equations.

---

## 🧠 Deployment Notes

This project is static and fully client-side.

* Works on Netlify, Vercel, or GitHub Pages
* Firebase credentials are entered by the user and never stored
* No backend server is required

---

## 📢 We Want Your Input!

This is a work-in-progress OpenSource project. We highly value community feedback. Please reach out if you have:

* Suggestions for more complex practical models
* UI/UX improvements
* Feature requests (e.g., 3-phase transformer support)
* Bug reports or issues with sensor readings

---

## 📬 Contact Information

* **Developer**: Arhum Naeem
* **Email**: [engr.arhumnaeem@gmail.com](mailto:engr.arhumnaeem@gmail.com)
* **Portfolio**: [arhumnaeem.netlify.app](https://arhumnaeem.netlify.app)

---

*Created for the 6th Semester EMS Course.*
*Proudly built as an open-source tool for electrical labs and learning.*


