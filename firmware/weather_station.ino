#include <Arduino.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <Wire.h>
#include <DHTesp.h>
#include <Adafruit_BMP085.h>
#include <math.h>

#define WIFI_SSID         "Wokwi-GUEST"
#define WIFI_PASSWORD     ""
#define WIFI_CHANNEL      6

#define MQTT_HOST         "broker.hivemq.com"
#define MQTT_PORT         1883
#define MQTT_USER         ""
#define MQTT_PASSWORD     ""
#define MQTT_TOPIC_PREFIX "weather/esp32-weather-01"

#define DEVICE_ID         "esp32-weather-01"

#define PUBLISH_INTERVAL_MS      10000UL
#define WIFI_CONNECT_TIMEOUT_MS  15000UL
#define WIFI_RETRY_INTERVAL_MS   5000UL
#define MQTT_RETRY_INTERVAL_MS   5000UL
#define MQTT_KEEPALIVE_S         30
#define MQTT_BUFFER_SIZE         512

const uint8_t DHT_PIN     = 4;
const uint8_t I2C_SDA_PIN = 21;
const uint8_t I2C_SCL_PIN = 22;

DHTesp dht;
Adafruit_BMP085 bmp;
WiFiClient wifiClient;
PubSubClient mqtt(wifiClient);

bool bmpReady = false;
uint32_t lastWifiAttempt = 0;
uint32_t lastMqttAttempt = 0;
String clientId;
String topicReadings;
String topicStatus;

struct Readings {
  bool  dhtOk;
  const char* dhtMsg;
  float dhtTemp, dhtHum;

  bool  bmpOk;
  const char* bmpMsg;
  float bmpPressHpa;
};

void onWiFiEvent(WiFiEvent_t event) {
  switch (event) {
    case ARDUINO_EVENT_WIFI_STA_CONNECTED:
      Serial.println("[WiFi] Associated with access point");
      break;
    case ARDUINO_EVENT_WIFI_STA_GOT_IP:
      Serial.print("[WiFi] Got IP: ");
      Serial.println(WiFi.localIP());
      break;
    case ARDUINO_EVENT_WIFI_STA_DISCONNECTED:
      Serial.println("[WiFi] Disconnected from access point");
      break;
    default:
      break;
  }
}

bool connectWifi(uint32_t timeoutMs) {
  Serial.print("[WiFi] Connecting to ");
  Serial.print(WIFI_SSID);
  Serial.print(" ");

  WiFi.disconnect(true);
  delay(100);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD, WIFI_CHANNEL);

  uint32_t start = millis();
  while (WiFi.status() != WL_CONNECTED && (millis() - start) < timeoutMs) {
    delay(250);
    Serial.print(".");
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("[WiFi] Connected. IP=");
    Serial.print(WiFi.localIP());
    Serial.print(" RSSI=");
    Serial.print(WiFi.RSSI());
    Serial.println(" dBm");
    return true;
  }

  Serial.print("[WiFi] Connection failed, status=");
  Serial.println((int)WiFi.status());
  return false;
}

bool ensureWifi() {
  if (WiFi.status() == WL_CONNECTED) return true;

  if (lastWifiAttempt != 0 && (millis() - lastWifiAttempt) < WIFI_RETRY_INTERVAL_MS) {
    return false;
  }
  lastWifiAttempt = millis();
  Serial.println("[WiFi] Link is down, reconnecting...");
  return connectWifi(10000UL);
}

bool connectMqtt() {
  Serial.printf("[MQTT] Connecting to %s:%d as %s ... ", MQTT_HOST, MQTT_PORT, clientId.c_str());

  bool ok;
  if (strlen(MQTT_USER) > 0) {
    ok = mqtt.connect(clientId.c_str(), MQTT_USER, MQTT_PASSWORD,
                      topicStatus.c_str(), 1, true, "offline");
  } else {
    ok = mqtt.connect(clientId.c_str(), topicStatus.c_str(), 1, true, "offline");
  }

  if (ok) {
    Serial.println("connected");
    mqtt.publish(topicStatus.c_str(), "online", true);
    return true;
  }

  Serial.printf("failed, rc=%d\n", mqtt.state());
  return false;
}

bool ensureMqtt() {
  if (WiFi.status() != WL_CONNECTED) return false;
  if (mqtt.connected()) return true;

  if (lastMqttAttempt != 0 && (millis() - lastMqttAttempt) < MQTT_RETRY_INTERVAL_MS) {
    return false;
  }
  lastMqttAttempt = millis();
  return connectMqtt();
}

void readDht(Readings &r) {
  r.dhtOk = false;
  r.dhtMsg = "not read";
  r.dhtTemp = NAN;
  r.dhtHum = NAN;

  for (uint8_t attempt = 0; attempt < 2 && !r.dhtOk; attempt++) {
    if (attempt > 0) delay(2100);

    TempAndHumidity d = dht.getTempAndHumidity();
    DHTesp::DHT_ERROR_t status = dht.getStatus();

    if (status != DHTesp::ERROR_NONE) {
      r.dhtMsg = dht.getStatusString();
      continue;
    }
    if (isnan(d.temperature) || isnan(d.humidity) ||
        d.temperature < -40.0f || d.temperature > 80.0f ||
        d.humidity < 0.0f || d.humidity > 100.0f) {
      r.dhtMsg = "value out of range";
      continue;
    }
    r.dhtOk = true;
    r.dhtMsg = "ok";
    r.dhtTemp = d.temperature;
    r.dhtHum = d.humidity;
  }
}

void initBmp() {
  bmpReady = bmp.begin();
  if (bmpReady) {
    Serial.println("[BMP180] Initialized");
  } else {
    Serial.println("[BMP180] NOT FOUND - check SDA/SCL/VCC wiring");
  }
}

void readBmp(Readings &r) {
  r.bmpOk = false;
  r.bmpMsg = "not read";
  r.bmpPressHpa = NAN;

  if (!bmpReady) initBmp();
  if (!bmpReady) {
    r.bmpMsg = "sensor not found";
    return;
  }

  int32_t pPa = bmp.readPressure();

  if (pPa < 30000 || pPa > 110000) {
    r.bmpMsg = "value out of range";
    bmpReady = false;
    return;
  }

  r.bmpOk = true;
  r.bmpMsg = "ok";
  r.bmpPressHpa = pPa / 100.0f;
}

String jnum(float v, uint8_t decimals) {
  if (isnan(v) || isinf(v)) return String("null");
  return String(v, (unsigned int)decimals);
}

String buildJson(const Readings &r) {
  String j;
  j.reserve(384);
  j += "{\"device_id\":\"";
  j += DEVICE_ID;
  j += "\",\"uptime_s\":";
  j += String((unsigned long)(millis() / 1000UL));
  j += ",\"wifi_rssi\":";
  j += String(WiFi.status() == WL_CONNECTED ? WiFi.RSSI() : 0);

  j += ",\"dht22\":{\"status\":\"";
  j += r.dhtMsg;
  j += "\",\"temperature_c\":";
  j += jnum(r.dhtTemp, 1);
  j += ",\"humidity_pct\":";
  j += jnum(r.dhtHum, 1);
  j += "}";

  j += ",\"bmp180\":{\"status\":\"";
  j += r.bmpMsg;
  j += "\",\"pressure_hpa\":";
  j += jnum(r.bmpPressHpa, 2);
  j += "}}";
  return j;
}

void printReadings(const Readings &r) {
  Serial.println();
  Serial.println("================ Sensor readings ================");

  Serial.print("DHT22  : ");
  if (r.dhtOk) {
    Serial.printf("%.1f C, %.1f %%RH\n", r.dhtTemp, r.dhtHum);
  } else {
    Serial.printf("ERROR (%s)\n", r.dhtMsg);
  }

  Serial.print("BMP180 : ");
  if (r.bmpOk) {
    Serial.printf("%.2f hPa\n", r.bmpPressHpa);
  } else {
    Serial.printf("ERROR (%s)\n", r.bmpMsg);
  }
  Serial.println("=================================================");
}

bool publishReadings(const Readings &r) {
  String body = buildJson(r);

  Serial.printf("[MQTT] Publishing to %s\n", topicReadings.c_str());
  Serial.println(body);

  if (mqtt.publish(topicReadings.c_str(), body.c_str())) {
    Serial.println("[MQTT] Publish OK");
    return true;
  }

  Serial.printf("[MQTT] Publish failed, state=%d\n", mqtt.state());
  mqtt.disconnect();
  return false;
}

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println();
  Serial.println("ESP32 Weather Station starting...");

  dht.setup(DHT_PIN, DHTesp::DHT22);
  Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);
  initBmp();

  clientId = String(DEVICE_ID) + "-" + String((uint32_t)random(0x10000), HEX);
  topicReadings = String(MQTT_TOPIC_PREFIX) + "/readings";
  topicStatus = String(MQTT_TOPIC_PREFIX) + "/status";

  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setKeepAlive(MQTT_KEEPALIVE_S);
  mqtt.setBufferSize(MQTT_BUFFER_SIZE);

  WiFi.onEvent(onWiFiEvent);
  WiFi.setAutoReconnect(true);
  WiFi.persistent(false);
  lastWifiAttempt = millis();
  connectWifi(WIFI_CONNECT_TIMEOUT_MS);
}

void loop() {
  static uint32_t lastCycle = 0;
  static bool firstCycle = true;

  if (mqtt.connected()) mqtt.loop();

  if (!firstCycle && (millis() - lastCycle) < PUBLISH_INTERVAL_MS) {
    delay(50);
    return;
  }
  firstCycle = false;
  lastCycle = millis();

  Readings r;
  readDht(r);
  readBmp(r);
  printReadings(r);

  if (ensureWifi() && ensureMqtt()) {
    publishReadings(r);
  } else {
    Serial.println("[MQTT] Skipped: no Wi-Fi or broker connection (will retry next cycle)");
  }
}