import ExpoModulesCore

/**
 * SharedDefaultsModule — App Group UserDefaults bridge for the MOAJOA iOS app.
 *
 * Wraps `UserDefaults(suiteName: APP_GROUP_ID)` so the React Native main app and
 * the Share Extension target can share a single bucket of JSON-encoded blobs
 * (pending_links queue, last_board_id, auth_status — Phase 3 D-02/D-05/D-06).
 *
 * All values cross the bridge as strings; JSON serialization happens in the
 * TS wrapper at apps/ios/lib/shared-defaults.ts. Synchronous read/write —
 * iOS UserDefaults is sync and the volume here is tiny (a few KB at most).
 */
public class SharedDefaultsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("SharedDefaults")

    Function("getString") { (suiteName: String, key: String) -> String? in
      return UserDefaults(suiteName: suiteName)?.string(forKey: key)
    }

    Function("setString") { (suiteName: String, key: String, value: String) -> Void in
      UserDefaults(suiteName: suiteName)?.set(value, forKey: key)
    }

    Function("remove") { (suiteName: String, key: String) -> Void in
      UserDefaults(suiteName: suiteName)?.removeObject(forKey: key)
    }
  }
}
