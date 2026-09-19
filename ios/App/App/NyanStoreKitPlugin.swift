import Foundation
import StoreKit
import Capacitor

@objc(NyanStoreKitPlugin)
public final class NyanStoreKitPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NyanStoreKitPlugin"
    public let jsName = "NyanStoreKit"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "loadProducts", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "purchase", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restorePurchases", returnType: CAPPluginReturnPromise),
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

    @objc func loadProducts(_ call: CAPPluginCall) {
        let ids = call.getArray("productIds", String.self) ?? []
        Task {
            do {
                let products = try await Product.products(for: ids)
                call.resolve(["products": products.map { product in
                    ["productId": product.id, "displayName": product.displayName, "description": product.description,
                     "displayPrice": product.displayPrice, "productType": String(describing: product.type)]
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

    @objc func restorePurchases(_ call: CAPPluginCall) {
        Task {
            do {
                try await AppStore.sync()
                var transactions: [[String: Any]] = []
                for await result in Transaction.currentEntitlements {
                    if case .verified(let transaction) = result { transactions.append(transactionPayload(result, transaction: transaction)) }
                }
                call.resolve(["transactions": transactions])
            } catch { call.reject("RESTORE_FAILED", error.localizedDescription, error) }
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

final class NyanBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() { bridge?.registerPluginInstance(NyanStoreKitPlugin()) }
}
