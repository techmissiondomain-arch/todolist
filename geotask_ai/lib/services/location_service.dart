import 'package:geolocator/geolocator.dart';
import 'package:permission_handler/permission_handler.dart';

import '../core/errors/failures.dart';
import '../core/utils/logger.dart';

/// Handles location PERMISSIONS and one-off position reads.
/// Continuous geofencing lives in GeofencingService.
///
/// Permission philosophy (see privacy section in README):
///   1) Ask for "while in use" first, with a clear reason.
///   2) Only ask for "always / background" when the user actually creates a
///      location reminder — and explain WHY (reminders must work in pocket).
class LocationService {
  LocationService._();
  static final LocationService instance = LocationService._();

  /// Are location services (GPS) turned on at the OS level?
  Future<bool> isServiceEnabled() => Geolocator.isLocationServiceEnabled();

  /// Step 1: foreground permission ("while using the app").
  Future<bool> requestWhileInUse() async {
    var perm = await Geolocator.checkPermission();
    if (perm == LocationPermission.denied) {
      perm = await Geolocator.requestPermission();
    }
    final ok = perm == LocationPermission.whileInUse ||
        perm == LocationPermission.always;
    Log.d('whileInUse permission => $perm');
    return ok;
  }

  /// Step 2: background permission ("always"). Call ONLY after explaining why,
  /// and only when the user opts into a location reminder.
  Future<bool> requestAlways() async {
    // permission_handler gives the clearest path to the "Always" option.
    final status = await Permission.locationAlways.request();
    Log.d('always permission => $status');
    return status.isGranted;
  }

  /// True if we already hold background ("always") permission.
  Future<bool> hasAlways() async {
    final perm = await Geolocator.checkPermission();
    return perm == LocationPermission.always;
  }

  /// Open the OS settings page (used when permission is permanently denied).
  Future<void> openSettings() => Geolocator.openAppSettings();

  /// Get the device's current position once. Throws a friendly failure.
  Future<Position> currentPosition() async {
    if (!await isServiceEnabled()) {
      throw const LocationFailure('Turn on location/GPS to use this feature.');
    }
    final ok = await requestWhileInUse();
    if (!ok) {
      throw const LocationFailure('Location permission is needed for this.');
    }
    try {
      return await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
        ),
      );
    } catch (e) {
      throw LocationFailure('Could not read your location.', e);
    }
  }

  /// Straight-line distance in meters between two points.
  double distanceMeters(
    double lat1,
    double lng1,
    double lat2,
    double lng2,
  ) =>
      Geolocator.distanceBetween(lat1, lng1, lat2, lng2);
}
