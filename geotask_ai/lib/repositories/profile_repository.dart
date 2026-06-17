import '../core/utils/logger.dart';
import '../models/profile.dart';
import '../services/supabase_service.dart';

/// Reads/writes the current user's profile + privacy toggles.
class ProfileRepository {
  final _sb = SupabaseService.instance;

  Future<Profile?> fetchMine() async {
    final uid = _sb.userId;
    if (uid == null) return null;
    try {
      final row = await _sb.client
          .from('profiles')
          .select()
          .eq('id', uid)
          .maybeSingle();
      return row == null ? null : Profile.fromMap(row);
    } catch (e) {
      Log.e('fetch profile failed', e);
      return null;
    }
  }

  Future<Profile> update(Profile profile) async {
    final row = await _sb.client
        .from('profiles')
        .update(profile.toUpdateMap())
        .eq('id', profile.id)
        .select()
        .single();
    return Profile.fromMap(row);
  }
}
