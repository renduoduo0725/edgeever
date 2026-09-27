import AppKit
import UniformTypeIdentifiers

/// Copies a file from the macOS share sheet into Downloads and opens EdgeEver.
/// WeChat merged-forward ZIPs stay on this path; the app turns those into chat notes
/// and turns every other file into a note attachment.
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
                if let copied = try await copyProvider(provider) {
                    return copied
                }
            }
        }
        throw CocoaError(.fileReadNoSuchFile)
    }

    /// Finder often hands over `public.file-url` as `file:///.file/id=…`. Asking for that
    /// type writes the URL text, not the file. Copy the security-scoped file when it is
    /// readable, and otherwise ask for the file's own content type.
    private func copyProvider(_ provider: NSItemProvider) async throws -> URL? {
        let fileURL = await loadFileURL(provider)
        if let fileURL, let copied = try await copySecurityScopedFile(fileURL, suggested: provider.suggestedName) {
            return copied
        }
        guard let type = contentType(for: provider) else { return nil }
        // The provider's temporary file exists only inside this callback.
        let filename = preferredFilename(suggested: provider.suggestedName, fileURL: fileURL, copiedSource: fileURL ?? URL(fileURLWithPath: "共享的文件"))
        return try await copyFileRepresentation(provider, type: type, filename: filename)
    }

    private func contentType(for provider: NSItemProvider) -> String? {
        let skipped: Set<String> = [
            UTType.fileURL.identifier,
            UTType.url.identifier,
            UTType.plainText.identifier,
            UTType.text.identifier,
            UTType.utf8PlainText.identifier,
            UTType.item.identifier,
        ]
        let registered = provider.registeredTypeIdentifiers.filter { !skipped.contains($0) }
        if let concrete = registered.first(where: { $0 != UTType.data.identifier && !$0.hasPrefix("dyn.") }) {
            return concrete
        }
        if registered.contains(UTType.data.identifier) || provider.hasItemConformingToTypeIdentifier(UTType.data.identifier) {
            return UTType.data.identifier
        }
        return registered.first
    }

    private func loadFileURL(_ provider: NSItemProvider) async -> URL? {
        guard provider.hasItemConformingToTypeIdentifier(UTType.fileURL.identifier) else { return nil }
        return await withCheckedContinuation { continuation in
            var resumed = false
            provider.loadItem(forTypeIdentifier: UTType.fileURL.identifier, options: nil) { item, _ in
                guard !resumed else { return }
                resumed = true
                if let url = item as? URL {
                    continuation.resume(returning: url)
                    return
                }
                if let data = item as? Data, let url = URL(dataRepresentation: data, relativeTo: nil), url.isFileURL {
                    continuation.resume(returning: url)
                    return
                }
                if let text = item as? String, let url = URL(string: text), url.isFileURL {
                    continuation.resume(returning: url)
                    return
                }
                continuation.resume(returning: nil)
            }
        }
    }

    private func copyFileRepresentation(_ provider: NSItemProvider, type: String, filename: String) async throws -> URL? {
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<URL?, Error>) in
            var resumed = false
            provider.loadFileRepresentation(forTypeIdentifier: type) { source, error in
                guard !resumed else { return }
                resumed = true
                guard let source else {
                    continuation.resume(throwing: error ?? CocoaError(.fileReadUnknown))
                    return
                }
                if self.isFileReferencePlaceholder(source) {
                    continuation.resume(returning: nil)
                    return
                }
                do {
                    let resolvedName = self.filenameWithExtension(from: source, preferred: filename)
                    continuation.resume(returning: try self.moveIntoIncoming(source, filename: resolvedName))
                } catch {
                    continuation.resume(throwing: error)
                }
            }
        }
    }

    private func copySecurityScopedFile(_ url: URL, suggested: String?) async throws -> URL? {
        let accessing = url.startAccessingSecurityScopedResource()
        defer { if accessing { url.stopAccessingSecurityScopedResource() } }
        let resolved = url.resolvingSymlinksInPath()
        var isDirectory = ObjCBool(false)
        guard FileManager.default.fileExists(atPath: resolved.path, isDirectory: &isDirectory), !isDirectory.boolValue else {
            return nil
        }
        guard FileManager.default.isReadableFile(atPath: resolved.path) else { return nil }
        let filename = preferredFilename(suggested: suggested, fileURL: url, copiedSource: resolved)
        return try moveIntoIncoming(resolved, filename: filename)
    }

    private func moveIntoIncoming(_ source: URL, filename: String) throws -> URL {
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
        let destination = batch.appendingPathComponent(filename, isDirectory: false)
        let partial = batch.appendingPathComponent("\(filename).partial", isDirectory: false)
        try FileManager.default.copyItem(at: source, to: partial)
        try FileManager.default.moveItem(at: partial, to: destination)
        return destination
    }

    private func isFileReferencePlaceholder(_ url: URL) -> Bool {
        guard let data = try? Data(contentsOf: url), data.count <= 256, let text = String(data: data, encoding: .utf8) else {
            return false
        }
        return text.hasPrefix("file:///.file/id=") && !text.contains("\n")
    }

    private func preferredFilename(suggested: String?, fileURL: URL?, copiedSource: URL) -> String {
        if let suggested {
            let trimmed = suggested.trimmingCharacters(in: .whitespacesAndNewlines)
            if !trimmed.isEmpty { return sanitizedFilename(trimmed) }
        }
        if let fileURL {
            let values = try? fileURL.resourceValues(forKeys: [.localizedNameKey, .nameKey])
            if let name = values?.localizedName ?? values?.name {
                let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
                if !trimmed.isEmpty && !trimmed.hasPrefix("id=") {
                    return sanitizedFilename(trimmed)
                }
            }
        }
        let copiedName = copiedSource.lastPathComponent
        if !copiedName.isEmpty && !copiedName.hasPrefix("id=") {
            return sanitizedFilename(copiedName)
        }
        return sanitizedFilename(nil)
    }

    private func filenameWithExtension(from source: URL, preferred: String) -> String {
        let sourceName = source.lastPathComponent
        let preferredExt = (preferred as NSString).pathExtension
        let sourceExt = (sourceName as NSString).pathExtension
        if preferredExt.isEmpty && !sourceExt.isEmpty && !sourceName.hasPrefix("id=") {
            return sanitizedFilename(sourceName)
        }
        return preferred
    }

    private func sanitizedFilename(_ suggested: String?) -> String {
        let fallback = Locale.preferredLanguages.first?.hasPrefix("zh") == true ? "共享的文件" : "Shared file"
        let base = ((suggested ?? fallback) as NSString).lastPathComponent
        let trimmed = base
            .replacingOccurrences(of: "/", with: "")
            .replacingOccurrences(of: ":", with: "")
            .replacingOccurrences(of: "\0", with: "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty || trimmed == "." || trimmed == ".." || trimmed.hasPrefix("id=") {
            return fallback
        }
        return trimmed
    }

    private func shareURL(for file: URL) -> URL? {
        var components = URLComponents()
        components.scheme = "edgeever"
        components.host = "share-import"
        components.queryItems = [URLQueryItem(name: "path", value: file.path)]
        return components.url
    }
}
