import 'package:flutter/material.dart';
import 'package:geocoding/geocoding.dart' as geo;
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:provider/provider.dart';

import '../../models/saved_location.dart';
import '../../providers/location_provider.dart';
import '../../services/location_service.dart';
import '../../services/supabase_service.dart';

/// Lets the user confirm an exact location on a map, name it, set a radius,
/// and save it. Returns the saved [SavedLocation] to the caller.
class LocationPickerScreen extends StatefulWidget {
  final String? initialName;
  final int initialRadius;
  const LocationPickerScreen({
    super.key,
    this.initialName,
    this.initialRadius = 200,
  });

  @override
  State<LocationPickerScreen> createState() => _LocationPickerScreenState();
}

class _LocationPickerScreenState extends State<LocationPickerScreen> {
  GoogleMapController? _map;
  late TextEditingController _name;
  late int _radius;
  LatLng _target = const LatLng(25.2048, 55.2708); // sensible default (Dubai)
  String? _address;
  bool _loading = true;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _name = TextEditingController(text: widget.initialName ?? '');
    _radius = widget.initialRadius;
    _init();
  }

  Future<void> _init() async {
    // 1) If the AI gave a name, try to geocode it to a starting point.
    if ((widget.initialName ?? '').trim().isNotEmpty) {
      try {
        final results = await geo.locationFromAddress(widget.initialName!);
        if (results.isNotEmpty) {
          _target = LatLng(results.first.latitude, results.first.longitude);
        }
      } catch (_) {/* fall through to device location */}
    } else {
      // 2) Otherwise center on the user's current position.
      try {
        final pos = await LocationService.instance.currentPosition();
        _target = LatLng(pos.latitude, pos.longitude);
      } catch (_) {/* keep default */}
    }
    await _reverseGeocode();
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _reverseGeocode() async {
    try {
      final placemarks =
          await geo.placemarkFromCoordinates(_target.latitude, _target.longitude);
      if (placemarks.isNotEmpty) {
        final p = placemarks.first;
        _address = [p.street, p.locality, p.country]
            .where((s) => (s ?? '').isNotEmpty)
            .join(', ');
      }
    } catch (_) {/* address is optional */}
  }

  Future<void> _save() async {
    final name = _name.text.trim();
    if (name.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Give this place a name.')));
      return;
    }
    setState(() => _saving = true);

    final draft = SavedLocation(
      id: 'tmp',
      userId: SupabaseService.instance.userId!,
      name: name,
      address: _address,
      latitude: _target.latitude,
      longitude: _target.longitude,
      radiusMeters: _radius,
      createdAt: DateTime.now(),
      updatedAt: DateTime.now(),
    );

    final saved = await context.read<LocationProvider>().add(draft);
    if (!mounted) return;
    setState(() => _saving = false);
    Navigator.of(context).pop(saved);
  }

  @override
  void dispose() {
    _name.dispose();
    _map?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    return Scaffold(
      appBar: AppBar(title: const Text('Pick a location')),
      body: Column(
        children: [
          Expanded(
            child: Stack(
              alignment: Alignment.center,
              children: [
                GoogleMap(
                  initialCameraPosition:
                      CameraPosition(target: _target, zoom: 16),
                  myLocationEnabled: true,
                  myLocationButtonEnabled: true,
                  circles: {
                    Circle(
                      circleId: const CircleId('radius'),
                      center: _target,
                      radius: _radius.toDouble(),
                      fillColor:
                          Theme.of(context).colorScheme.primary.withValues(alpha: 0.15),
                      strokeColor: Theme.of(context).colorScheme.primary,
                      strokeWidth: 2,
                    ),
                  },
                  onMapCreated: (c) => _map = c,
                  onCameraMove: (pos) => _target = pos.target,
                  onCameraIdle: () async {
                    await _reverseGeocode();
                    if (mounted) setState(() {});
                  },
                ),
                // A fixed center pin — user moves the map under it.
                const IgnorePointer(
                  child: Padding(
                    padding: EdgeInsets.only(bottom: 36),
                    child: Icon(Icons.location_pin, size: 48, color: Colors.red),
                  ),
                ),
              ],
            ),
          ),
          _editor(),
        ],
      ),
    );
  }

  Widget _editor() => SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              TextField(
                controller: _name,
                decoration: const InputDecoration(
                  labelText: 'Name (e.g. Home, Carrefour)',
                ),
              ),
              if (_address != null)
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Text(_address!,
                      style: Theme.of(context).textTheme.bodySmall),
                ),
              const SizedBox(height: 8),
              Text('Radius: $_radius m',
                  style: Theme.of(context).textTheme.titleSmall),
              Slider(
                value: _radius.toDouble(),
                min: 50,
                max: 1000,
                divisions: 19,
                label: '$_radius m',
                onChanged: (v) => setState(() => _radius = v.round()),
              ),
              FilledButton.icon(
                onPressed: _saving ? null : _save,
                icon: _saving
                    ? const SizedBox(
                        height: 18,
                        width: 18,
                        child: CircularProgressIndicator(strokeWidth: 2))
                    : const Icon(Icons.check),
                label: const Text('Use this location'),
              ),
            ],
          ),
        ),
      );
}
