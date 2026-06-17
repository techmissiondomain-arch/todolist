import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../models/enums.dart';
import '../../models/task.dart';
import '../../providers/task_provider.dart';
import '../add_task/add_task_screen.dart';
import '../saved_locations/saved_locations_screen.dart';
import '../settings/settings_screen.dart';
import '../task_detail/task_detail_screen.dart';
import '../widgets/task_tile.dart';

/// The main screen: a list of tasks (open + done), with quick access to
/// places and settings, and a big "+" to add via AI.
class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<TaskProvider>();

    return Scaffold(
      appBar: AppBar(
        title: const Text('GeoTask'),
        actions: [
          IconButton(
            icon: const Icon(Icons.place_outlined),
            tooltip: 'Saved places',
            onPressed: () => Navigator.of(context).push(MaterialPageRoute(
                builder: (_) => const SavedLocationsScreen())),
          ),
          IconButton(
            icon: const Icon(Icons.settings_outlined),
            tooltip: 'Settings',
            onPressed: () => Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const SettingsScreen())),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => Navigator.of(context).push(
            MaterialPageRoute(builder: (_) => const AddTaskScreen())),
        icon: const Icon(Icons.add),
        label: const Text('Add task'),
      ),
      body: RefreshIndicator(
        onRefresh: provider.load,
        child: _body(context, provider),
      ),
    );
  }

  Widget _body(BuildContext context, TaskProvider provider) {
    if (provider.loading && provider.tasks.isEmpty) {
      return const Center(child: CircularProgressIndicator());
    }
    if (provider.error != null && provider.tasks.isEmpty) {
      return _Centered(
        icon: Icons.cloud_off,
        title: 'Could not load tasks',
        message: provider.error!,
      );
    }
    if (provider.tasks.isEmpty) {
      return const _Centered(
        icon: Icons.checklist_rtl,
        title: 'No tasks yet',
        message: 'Tap “Add task” and just describe what you need.',
      );
    }

    final open = provider.openTasks;
    final done = provider.doneTasks;

    return ListView(
      padding: const EdgeInsets.fromLTRB(12, 8, 12, 96),
      children: [
        if (open.isNotEmpty) const _SectionHeader('To do'),
        ...open.map((t) => _tile(context, provider, t)),
        if (done.isNotEmpty) const _SectionHeader('Done'),
        ...done.map((t) => _tile(context, provider, t)),
      ],
    );
  }

  Widget _tile(BuildContext context, TaskProvider provider, Task t) => TaskTile(
        task: t,
        onToggle: () => t.status == TaskStatus.done
            ? provider.reopen(t.id)
            : provider.complete(t.id),
        onTap: () => Navigator.of(context).push(
          MaterialPageRoute(builder: (_) => TaskDetailScreen(task: t)),
        ),
      );
}

class _SectionHeader extends StatelessWidget {
  final String text;
  const _SectionHeader(this.text);
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(8, 16, 8, 8),
        child: Text(text, style: Theme.of(context).textTheme.titleSmall),
      );
}

class _Centered extends StatelessWidget {
  final IconData icon;
  final String title;
  final String message;
  const _Centered(
      {required this.icon, required this.title, required this.message});

  @override
  Widget build(BuildContext context) => ListView(
        children: [
          const SizedBox(height: 120),
          Icon(icon, size: 72, color: Theme.of(context).colorScheme.outline),
          const SizedBox(height: 16),
          Center(
              child: Text(title,
                  style: Theme.of(context).textTheme.titleMedium)),
          const SizedBox(height: 8),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 40),
            child: Text(message, textAlign: TextAlign.center),
          ),
        ],
      );
}
