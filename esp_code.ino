#include <WiFi.h>
#include <Firebase_ESP_Client.h>


#define WIFI_SSID "Arhum A03"
#define WIFI_PASSWORD "p@ssw0rD</this_pw>"


#define API_KEY "FIREBASE_API_KEY"
#define DATABASE_URL "database_url"


FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

#define VP_SENSOR_PIN 34
#define VS_SENSOR_PIN 35
#define IP_SENSOR_PIN 32
#define IS_SENSOR_PIN 33

float voltageCalibration = 100.0;
float currentCalibration = 30.0;


int np = 1000;
int ns = 500;
float rw = 0.5;
float xm = 500.0;
float phi = 0;

void connectWiFi() {
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nConnected!");
}

void setupFirebase() {
  config.api_key = API_KEY;
  config.database_url = DATABASE_URL;

  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);
}

float readVoltage(int pin) {
  int raw = analogRead(pin);
  float voltage = (raw / 4095.0) * 3.3;
  return voltage * voltageCalibration;
}

float readCurrent(int pin) {
  int raw = analogRead(pin);
  float voltage = (raw / 4095.0) * 3.3;
  return voltage * currentCalibration;
}

void setup() {
  Serial.begin(115200);
  connectWiFi();
  setupFirebase();
}

void loop() {

  float vp = readVoltage(VP_SENSOR_PIN);
  float vs = readVoltage(VS_SENSOR_PIN);
  float ip = readCurrent(IP_SENSOR_PIN);
  float is = readCurrent(IS_SENSOR_PIN);

  float zl = (is != 0) ? (vs / is) : 0;

  FirebaseJson json;
  json.set("vp", vp);
  json.set("vs", vs);
  json.set("ip", ip);
  json.set("is", is);
  json.set("np", np);
  json.set("ns", ns);
  json.set("zl", zl);
  json.set("phi", phi);
  json.set("rw", rw);
  json.set("xm", xm);

  Serial.println("Uploading Data...");

  if (Firebase.RTDB.setJSON(&fbdo, "/transformer/live", &json)) {
    Serial.println("Upload successful");
  } else {
    Serial.println("Upload failed");
    Serial.println(fbdo.errorReason());
  }

  delay(1000);
}