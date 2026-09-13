# Hardware SOS Architecture

Recommended prototype BOM:
1. ESP32-class controller
2. GNSS receiver
3. LTE/4G modem + SIM
4. 6-axis IMU
5. physical SOS button
6. buzzer/status LED
7. protected battery + charging circuit

Automatic event candidates:
- high-g impact
- rollover/orientation anomaly
- immobilization after impact
- panic button
- route/geofence incident correlation

A secure event should contain:
device_id, timestamp, latitude, longitude, speed, heading, event_type, severity,
firmware_version, event_id and a cryptographic signature.

Do not implement unofficial police calls/SMS in the hackathon prototype.
Use a sandbox or authorized emergency-services endpoint.
