import UIKit
import Capacitor
import GoogleMobileAds
import AppTrackingTransparency

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Keep identifier-based personalization off, including before ATT is resolved.
        MobileAds.shared.requestConfiguration.setPublisherFirstPartyIDEnabled(false)
        MobileAds.shared.requestConfiguration.publisherPrivacyPersonalizationState = .disabled
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ application: UIApplication,
                     configurationForConnecting connectingSceneSession: UISceneSession,
                     options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        let config = UISceneConfiguration(name: "Default Configuration",
                                          sessionRole: connectingSceneSession.role)
        config.delegateClass = SceneDelegate.self
        return config
    }
}

// Resolve ATT before JS initializes advertising. Never read or return the IDFA.
@objc(NyanAdPrivacyPlugin)
public final class NyanAdPrivacyPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NyanAdPrivacyPlugin"
    public let jsName = "NyanAdPrivacy"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "prepareAdvertising", returnType: CAPPluginReturnPromise)
    ]
    private var pendingCalls: [CAPPluginCall] = []

    @objc func prepareAdvertising(_ call: CAPPluginCall) {
        Task { @MainActor in
            self.pendingCalls.append(call)
            guard self.pendingCalls.count == 1 else { return }
            // ATT cannot display while inactive or another system prompt is visible.
            for _ in 0..<100 {
                if UIApplication.shared.applicationState == .active { break }
                try? await Task.sleep(nanoseconds: 100_000_000)
            }
            guard UIApplication.shared.applicationState == .active else {
                self.finish(nil); return
            }
            if ATTrackingManager.trackingAuthorizationStatus == .notDetermined {
                _ = await ATTrackingManager.requestTrackingAuthorization()
                self.finish(ATTrackingManager.trackingAuthorizationStatus)
            } else {
                self.finish(ATTrackingManager.trackingAuthorizationStatus)
            }
        }
    }

    private func finish(_ status: ATTrackingManager.AuthorizationStatus?) {
        let calls = pendingCalls
        pendingCalls.removeAll()
        // Fail closed if the OS could not present ATT. A later attempt may retry.
        guard let status = status, status != .notDetermined else {
            calls.forEach { $0.reject("ATT_NOT_RESOLVED") }; return
        }
        let name: String
        switch status {
        case .authorized: name = "authorized"
        case .denied: name = "denied"
        case .restricted: name = "restricted"
        default: calls.forEach { $0.reject("ATT_UNKNOWN_STATUS") }; return
        }
        calls.forEach { $0.resolve(["status": name, "trackingAuthorized": status == .authorized]) }
    }
}
