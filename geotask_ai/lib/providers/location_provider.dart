import 'package:flutter/foundation.dart';

import '../models/saved_location.dart';
import '../repositories/location_repository.dart';

/// Owns the list of saved places and resolves AI place-names to coordinates.
class LocationProvider extends ChangeNotifier {
  final LocationRepository _repo = LocationRepository();

  List<SavedLocation> _places = [];
  List<SavedLocation> get places => _places;

  bool loading = false;
  String? error;

  Future<void> load() async {
    loading = true;
    error = null;
    notifyListeners();
    try {
      _places = await _repo.fetchAll();
    } catch (e) {
      error = e.toString();
    } finally {
      loading = false;
      notifyListeners();
    }
  }

  /// Try to match an AI-provided name (e.g. "home", "Carrefour") to a place
  /// the user already saved. Returns null if none — the UI then sends the
  /// user to the location picker.
  Future<SavedLocation?> resolveByName(String? name) async {
    if (name == null || name.trim().isEmpty) return null;
    // First check the in-memory list (fast), then the DB (case-insensitive).
    for (final p in _places) {
      if (p.name.toLowerCase() == name.trim().toLowerCase()) return p;
    }
    return _repo.findByName(name);
  }

  Future<SavedLocation?> add(SavedLocation loc) async {
    try {
      final created = await _repo.create(loc);
      _places = [..._places, created]..sort((a, b) => a.name.compareTo(b.name));
      notifyListeners();
      return created;
    } catch (e) {
      error = e.toString();
      notifyListeners();
      return null;
    }
  }

  Future<void> update(SavedLocation loc) async {
    final updated = await _repo.update(loc);
    _places =
        _places.map((p) => p.id == updated.id ? updated : p).toList();
    notifyListeners();
  }

  Future<void> remove(String id) async {
    await _repo.delete(id);
    _places = _places.where((p) => p.id != id).toList();
    notifyListeners();
  }
}
