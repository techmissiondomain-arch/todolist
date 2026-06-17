import '../core/errors/failures.dart';
import '../core/utils/logger.dart';
import '../models/saved_location.dart';
import '../services/supabase_service.dart';

/// Reads/writes saved places (Home, Work, Carrefour...).
class LocationRepository {
  final _sb = SupabaseService.instance;

  String get _uid {
    final id = _sb.userId;
    if (id == null) throw const AuthFailure('Not signed in.');
    return id;
  }

  Future<List<SavedLocation>> fetchAll() async {
    try {
      final rows = await _sb.client
          .from('saved_locations')
          .select()
          .eq('user_id', _uid)
          .order('name');
      return (rows as List)
          .map((r) => SavedLocation.fromMap(r as Map<String, dynamic>))
          .toList();
    } catch (e) {
      Log.e('fetch saved_locations failed', e);
      throw const NetworkFailure('Could not load your places.');
    }
  }

  /// Find a saved place by name (case-insensitive). Used to auto-resolve
  /// "home" / "Carrefour" coming from the AI parser.
  Future<SavedLocation?> findByName(String name) async {
    final rows = await _sb.client
        .from('saved_locations')
        .select()
        .eq('user_id', _uid)
        .ilike('name', name.trim());
    final list = rows as List;
    if (list.isEmpty) return null;
    return SavedLocation.fromMap(list.first as Map<String, dynamic>);
  }

  Future<SavedLocation> create(SavedLocation loc) async {
    final row = await _sb.client
        .from('saved_locations')
        .insert(loc.toInsertMap())
        .select()
        .single();
    return SavedLocation.fromMap(row);
  }

  Future<SavedLocation> update(SavedLocation loc) async {
    final row = await _sb.client
        .from('saved_locations')
        .update(loc.toInsertMap())
        .eq('id', loc.id)
        .select()
        .single();
    return SavedLocation.fromMap(row);
  }

  Future<void> delete(String id) async {
    await _sb.client.from('saved_locations').delete().eq('id', id);
  }
}
