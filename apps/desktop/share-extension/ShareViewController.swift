import AppKit
import UniformTypeIdentifiers

/// Receives WeChat's merged-forward ZIP and hands the file to the EdgeEver app.
@objc(ShareViewController)
final class ShareViewController: NSViewController {
    private let incomingDirectoryName = "EdgeEver Incoming"
    private var started = false

    override func loadView() {
        let chinese = Locale.preferredLanguages.first?.hasPrefix("zh") == true
        let label = NSTextField(labelWithString: chinese ? "正在保存到 EdgeEver…" : "Saving to EdgeEver…")
        label.frame = NSRect(x: 16, y: 28, width: 248, height: 24)
        let container = NSView(frame: NSRect(x: 0, y: 0, width: 280, height: 80))
        container.addSubview(label)
        view = container
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        beginImport()
    }

    override func viewDidAppear() {
        super.viewDidAppear()
        beginImport()
    }

    private func beginImport() {
        guard !started else { return }
        started = true
        Task { await importShare() }
    }

    private func importShare() async {
        do {
            let destination = try await copySharedFile()
            guard let url = shareURL(for: destination) else {
                throw CocoaError(.fileWriteUnknown)
            }
            guard let context = extensionContext else {
                throw CocoaError(.fileReadUnknown)
            }
            _ = NSWorkspace.shared.open(url)
            context.completeRequest(returningItems: nil)
        } catch {
            extensionContext?.cancelRequest(withError: error)
        }
    }

    private func copySharedFile() async throws -> URL {
        guard let items = extensionContext?.inputItems as? [NSExtensionItem] else {
            throw CocoaError(.fileReadNoSuchFile)
        }
        for item in items {
            for provider in item.attachments ?? [] {
                guard let type = preferredType(for: provider) else { continue }
                return try await writeProvider(provider, type: type)
            }
        }
        throw CocoaError(.fileReadNoSuchFile)
    }

    private func preferredType(for provider: NSItemProvider) -> String? {
        let preferred = [
            UTType.zip.identifier,
            UTType.fileURL.identifier,
            UTType.data.identifier,
            UTType.item.identifier,
        ]
        return preferred.first { provider.hasItemConformingToTypeIdentifier($0) }
    }

    private func writeProvider(_ provider: NSItemProvider, type: String) async throws -> URL {
        let downloads = try FileManager.default.url(
            for: .downloadsDirectory,
            in: .userDomainMask,
            appropriateFor: nil,
            create: true
        )
        let batch = downloads
            .appendingPathComponent(incomingDirectoryName, isDirectory: true)
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        try FileManager.default.createDirectory(at: batch, withIntermediateDirectories: true)
        let filename = sanitizedFilename(provider.suggestedName)
        let destination = batch.appendingPathComponent(filename, isDirectory: false)
        let partial = batch.appendingPathComponent("\(filename).partial", isDirectory: false)
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            provider.loadFileRepresentation(forTypeIdentifier: type) { source, error in
                guard let source else {
                    continuation.resume(throwing: error ?? CocoaError(.fileReadUnknown))
                    return
                }
                do {
                    try FileManager.default.copyItem(at: source, to: partial)
                    try FileManager.default.moveItem(at: partial, to: destination)
                    continuation.resume()
                } catch {
                    continuation.resume(throwing: error)
                }
            }
        }
        return destination
    }

    private func sanitizedFilename(_ suggested: String?) -> String {
        let base = ((suggested ?? "聊天记录.zip") as NSString).lastPathComponent
        let trimmed = base.replacingOccurrences(of: "/", with: "").trimmingCharacters(in: .whitespacesAndNewlines)
        let name = trimmed.isEmpty ? "聊天记录.zip" : trimmed
        return (name as NSString).pathExtension.lowercased() == "zip" ? name : "\(name).zip"
    }

    private func shareURL(for file: URL) -> URL? {
        var components = URLComponents()
        components.scheme = "edgeever"
        components.host = "wechat-import"
        components.queryItems = [URLQueryItem(name: "path", value: file.path)]
        return components.url
    }
}
