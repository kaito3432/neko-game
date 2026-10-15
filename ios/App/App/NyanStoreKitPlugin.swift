import Foundation
import StoreKit
import Capacitor
import UIKit
import WebKit

@objc(NyanStoreKitPlugin)
public final class NyanStoreKitPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NyanStoreKitPlugin"
    public let jsName = "NyanStoreKit"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "loadProducts", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "purchase", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restorePurchases", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "currentEntitlements", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "unfinishedTransactions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "finishTransaction", returnType: CAPPluginReturnPromise)
    ]
    private var updatesTask: Task<Void, Never>?

    public override func load() {
        updatesTask = Task { [weak self] in
            for await result in Transaction.updates {
                guard case .verified(let transaction) = result else { continue }
                self?.notifyListeners("storeKitTransactionUpdated", data: self?.transactionPayload(result, transaction: transaction) ?? [:])
            }
        }
    }

    deinit { updatesTask?.cancel() }

    @objc func unfinishedTransactions(_ call: CAPPluginCall) {
        Task {
            var transactions: [[String: Any]] = []
            for await result in Transaction.unfinished {
                if case .verified(let transaction) = result {
                    transactions.append(transactionPayload(result, transaction: transaction))
                }
            }
            call.resolve(["transactions": transactions])
        }
    }

    @objc func loadProducts(_ call: CAPPluginCall) {
        let ids = call.getArray("productIds", String.self) ?? []
        Task {
            do {
                let products = try await Product.products(for: ids)
                call.resolve(["products": products.map { product -> [String: Any] in
                    var item: [String: Any] = ["productId": product.id, "displayName": product.displayName,
                        "description": product.description, "displayPrice": product.displayPrice,
                        "currencyCode": product.priceFormatStyle.currencyCode,
                        "productType": String(describing: product.type)]
                    if let subscription = product.subscription {
                        let period = subscription.subscriptionPeriod
                        item["subscriptionGroupId"] = subscription.subscriptionGroupID
                        item["subscriptionPeriod"] = ["unit": String(describing: period.unit), "value": period.value]
                    }
                    return item
                }])
            } catch { call.reject("PRODUCT_LOAD_FAILED", error.localizedDescription, error) }
        }
    }

    @objc func purchase(_ call: CAPPluginCall) {
        guard let productId = call.getString("productId") else { call.reject("INVALID_PRODUCT_ID"); return }
        Task {
            do {
                guard let product = try await Product.products(for: [productId]).first else { call.reject("PRODUCT_NOT_FOUND"); return }
                var options = Set<Product.PurchaseOption>()
                if let token = call.getString("appAccountToken"), let uuid = UUID(uuidString: token) { options.insert(.appAccountToken(uuid)) }
                switch try await product.purchase(options: options) {
                case .success(let result):
                    switch result {
                    case .verified(let transaction): call.resolve(["status": "purchased", "transaction": transactionPayload(result, transaction: transaction)])
                    case .unverified: call.reject("TRANSACTION_UNVERIFIED")
                    }
                case .userCancelled: call.resolve(["status": "cancelled"])
                case .pending: call.resolve(["status": "pending"])
                @unknown default: call.reject("UNKNOWN_PURCHASE_RESULT")
                }
            } catch { call.reject("PURCHASE_FAILED", error.localizedDescription, error) }
        }
    }

    private func restorableTransactions() async -> [[String: Any]] {
        let ids: Set<String> = ["SKILL_CAT_FAKE_PAW", "SKILL_POLICE_GROUP_SEARCH", "SKILL_POLICE_DASH", "SKILL_PACK_01", "REMOVE_ADS", "REMOVE_ADS_PLUS_SKILL_PACK_01"]
        var transactions: [[String: Any]] = []
        for await result in Transaction.currentEntitlements {
            guard case .verified(let transaction) = result,
                  ids.contains(transaction.productID), transaction.productType == .nonConsumable,
                  transaction.revocationDate == nil, transaction.ownershipType == .purchased else { continue }
            transactions.append(transactionPayload(result, transaction: transaction))
        }
        return transactions
    }

    @objc func restorePurchases(_ call: CAPPluginCall) {
        Task {
            let existing = await restorableTransactions()
            // Explicit forceSync supports missing purchases without adding UI.
            if !existing.isEmpty && !call.getBool("forceSync", false) {
                call.resolve(["status": "available", "transactions": existing])
                return
            }
            do {
                try await AppStore.sync()
                let transactions = await restorableTransactions()
                call.resolve(["status": transactions.isEmpty ? "noPurchases" : "available", "transactions": transactions])
            } catch StoreKitError.userCancelled {
                call.resolve(["status": "cancelled", "transactions": []])
            } catch {
                let nativeError = error as NSError
                call.reject("購入の同期に失敗しました", "RESTORE_SYNC_FAILED", error,
                            ["errorDomain": nativeError.domain, "errorCode": nativeError.code])
            }
        }
    }

    @objc func currentEntitlements(_ call: CAPPluginCall) {
        let ids = Set(call.getArray("productIds", String.self) ?? [])
        Task {
            var transactions: [[String: Any]] = []
            for await result in Transaction.currentEntitlements {
                if case .verified(let transaction) = result, ids.isEmpty || ids.contains(transaction.productID) {
                    transactions.append(transactionPayload(result, transaction: transaction))
                }
            }
            call.resolve(["transactions": transactions])
        }
    }

    @objc func finishTransaction(_ call: CAPPluginCall) {
        guard let requested = call.getString("transactionId") else { call.reject("INVALID_TRANSACTION_ID"); return }
        Task {
            for await result in Transaction.all {
                if case .verified(let transaction) = result, String(transaction.id) == requested { await transaction.finish(); call.resolve(); return }
            }
            call.reject("TRANSACTION_NOT_FOUND")
        }
    }

    private func transactionPayload(_ result: VerificationResult<Transaction>, transaction: Transaction) -> [String: Any] {
        ["transactionId": String(transaction.id), "originalTransactionId": String(transaction.originalID),
         "productId": transaction.productID, "purchaseDate": transaction.purchaseDate.timeIntervalSince1970 * 1000,
         "signedTransaction": result.jwsRepresentation]
    }
}

@objc(NyanReviewPlugin)
public final class NyanReviewPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NyanReviewPlugin"
    public let jsName = "NyanReview"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getEnvironment", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestReview", returnType: CAPPluginReturnPromise)
    ]

    @objc func getEnvironment(_ call: CAPPluginCall) {
        #if DEBUG
        call.resolve([
            "debug": true,
            "screenshotMode": ProcessInfo.processInfo.environment["NYAN_SCREENSHOT_MODE"] == "1"
        ])
        #else
        call.resolve(["debug": false])
        #endif
    }

    @objc func requestReview(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let scene = self.bridge?.viewController?.view.window?.windowScene else {
                call.reject("REVIEW_SCENE_UNAVAILABLE")
                return
            }
            if #available(iOS 16.0, *) {
                AppStore.requestReview(in: scene)
            } else {
                SKStoreReviewController.requestReview(in: scene)
            }
            call.resolve()
        }
    }
}

final class NyanBridgeViewController: CAPBridgeViewController {
    #if DEBUG
    override func webViewConfiguration(for instanceConfiguration: InstanceConfiguration) -> WKWebViewConfiguration {
        let configuration = super.webViewConfiguration(for: instanceConfiguration)
        if ProcessInfo.processInfo.environment["NYAN_SCREENSHOT_MODE"] == "1" {
            configuration.websiteDataStore = .nonPersistent()
        }
        return configuration
    }
    override func webView(with frame: CGRect, configuration: WKWebViewConfiguration) -> WKWebView {
        // Capacitor replaces the controller after webViewConfiguration(); inject after replacement.
        if ProcessInfo.processInfo.environment["NYAN_SCREENSHOT_MODE"] == "1" {
            configuration.userContentController.addUserScript(WKUserScript(
                source: "Object.defineProperty(window, '__nyanScreenshotIsolated', {value:true});",
                injectionTime: .atDocumentStart, forMainFrameOnly: true))
        }
        return super.webView(with: frame, configuration: configuration)
    }
    #endif
    override func capacitorDidLoad() {
        #if DEBUG
        if ProcessInfo.processInfo.environment["NYAN_SCREENSHOT_MODE"] == "1" {
            bridge?.registerPluginInstance(NyanReviewPlugin())
            return
        }
        #endif
        bridge?.registerPluginInstance(NyanStoreKitPlugin())
        bridge?.registerPluginInstance(NyanReviewPlugin())
    }
}
