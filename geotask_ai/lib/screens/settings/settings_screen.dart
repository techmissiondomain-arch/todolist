import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../models/profile.dart';
import '../../providers/auth_provider.dart';
import '../../repositories/profile_repository.dart';
import '../../services/geofencing_service.dart';
import '../../services/location_service.dart';

/// Settings + privacy controls. The user can disable location features and
/// notifications, and sign out. Reflects the app's privacy promises.
class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  final _profiles = ProfileRepository();
  Profile? _profile;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final p = await _profiles.fetchMine();
    if (mounted) {
      setState(() {
        _profile = p;
        _loading = false;
      });
    }
  }

  Future<void> _update(Profile updated) async {
    setState(() => _profile = updated);
    await _profiles.update(updated);

    // If the user turned location off, stop watching geofences immediately.
    if (!updated.locationEnabled) {
      await GeofencingService.instance.stop();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              children: [
                _section('Account'),
                ListTile(
                  leading: const Icon(Icons.person_outline),
                  title: Text(_profile?.fullName?.isNotEmpty == true
                      ? _profile!.fullName!
                      : 'Your account'),
                  subtitle: Text(_profile?.email ?? ''),
                ),
                const Divider(),
                _section('Location & privacy'),
                SwitchListTile(
                  title: const Text('Location reminders'),
                  subtitle: const Text(
                      'Allow GeoTask to remind you based on where you are.'),
                  value: _profile?.locationEnabled ?? false,
                  onChanged: _profile == null
                      ? null
                      : (v) =>
                          _update(_profile!.copyWith(locationEnabled: v)),
                ),
                SwitchListTile(
                  title: const Text('Background location'),
                  subtitle: const Text(
                      'Needed so reminders fire when the app is closed.'),
                  value: _profile?.backgroundLocationOk ?? false,
                  onChanged: (_profile?.locationEnabled ?? false)
                      ? (v) async {
                          if (v) {
                            final ok = await LocationService.instance
                                .requestAlways();
                            _update(_profile!
                                .copyWith(backgroundLocationOk: ok));
                          } else {
                            _update(_profile!
                                .copyWith(backgroundLocationOk: false));
                          }
                        }
                      : null,
                ),
                SwitchListTile(
                  title: const Text('Notifications'),
                  value: _profile?.notificationsEnabled ?? false,
                  onChanged: _profile == null
                      ? null
                      : (v) => _update(
                          _profile!.copyWith(notificationsEnabled: v)),
                ),
                ListTile(
                  leading: const Icon(Icons.shield_outlined),
                  title: const Text('Our privacy promise'),
                  subtitle: const Text(
                      'We never sell your location. We store only the places '
                      'you add, and you can delete them anytime.'),
                ),
                ListTile(
                  leading: const Icon(Icons.settings_applications_outlined),
                  title: const Text('Open system location settings'),
                  onTap: () => LocationService.instance.openSettings(),
                ),
                const Divider(),
                _section('Session'),
                ListTile(
                  leading: const Icon(Icons.logout, color: Colors.red),
                  title: const Text('Sign out',
                      style: TextStyle(color: Colors.red)),
                  onTap: () async {
                    await GeofencingService.instance.stop();
                    if (context.mounted) {
                      await context.read<AuthProvider>().signOut();
                      if (context.mounted) Navigator.pop(context);
                    }
                  },
                ),
                const SizedBox(height: 24),
              ],
            ),
    );
  }

  Widget _section(String title) => Padding(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 4),
        child: Text(title,
            style: Theme.of(context)
                .textTheme
                .titleSmall
                ?.copyWith(color: Theme.of(context).colorScheme.primary)),
      );
}
