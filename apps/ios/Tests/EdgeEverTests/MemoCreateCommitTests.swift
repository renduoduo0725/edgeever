import XCTest
@testable import EdgeEver

/// Drives the shipped create-Done path (`MemoCreateCommit.commit`).
/// Guards Android parity: after image materialize, Done must update — not second create.
final class MemoCreateCommitTests: XCTestCase {
    func testConsecutiveSharesKeepCurrentInputUntilCoverDismisses() throws {
        var presentation = MemoCreatePresentation()
        let article = MemoCreatePresentation.Request(
            seed: CreateMemoSeed(title: "Zhihu thought", contentMarkdown: "First share", tagsText: "")
        )
        let image = ShareHandoffStore.SharedImage(
            fileURL: URL(fileURLWithPath: "/tmp/second-share.jpg"),
            filename: "second-share.jpg",
            mimeType: "image/jpeg"
        )
        let next = MemoCreatePresentation.Request(
            seed: CreateMemoSeed(title: "Shared image", contentMarkdown: "", tagsText: ""),
            sharedImages: [image]
        )
        XCTAssertTrue(presentation.open(article))
        XCTAssertFalse(presentation.shouldFinishForIncomingShare)
        XCTAssertFalse(presentation.open(next))
        // A pending share or failed save must not change the mounted editor's inputs.
        XCTAssertEqual(presentation.current?.id, article.id)
        XCTAssertEqual(presentation.current?.seed, article.seed)
        XCTAssertEqual(presentation.current?.sharedImages, [])
        XCTAssertTrue(presentation.shouldFinishForIncomingShare)
        XCTAssertEqual(presentation.pending.count, 1)

        XCTAssertTrue(presentation.didDismiss())
        XCTAssertEqual(presentation.current?.id, next.id)
        XCTAssertNotEqual(presentation.current?.id, article.id)
        XCTAssertEqual(presentation.current?.sharedImages, [image])
        XCTAssertEqual(presentation.current?.seed?.contentMarkdown, "")
        XCTAssertFalse(presentation.shouldFinishForIncomingShare)
        XCTAssertFalse(presentation.didDismiss())
        XCTAssertNil(presentation.current)
    }

    func testAdditionalSharesArePresentedInOrderAfterEachDismissal() {
        var presentation = MemoCreatePresentation()
        let requests = (1...3).map { index in
            MemoCreatePresentation.Request(
                seed: CreateMemoSeed(title: "Share \(index)", contentMarkdown: "", tagsText: "")
            )
        }
        XCTAssertTrue(presentation.open(requests[0]))
        XCTAssertFalse(presentation.open(requests[1]))
        XCTAssertFalse(presentation.open(requests[2]))
        XCTAssertTrue(presentation.didDismiss())
        XCTAssertEqual(presentation.current?.id, requests[1].id)
        XCTAssertTrue(presentation.shouldFinishForIncomingShare)
        XCTAssertTrue(presentation.didDismiss())
        XCTAssertEqual(presentation.current?.id, requests[2].id)
        XCTAssertFalse(presentation.shouldFinishForIncomingShare)
        XCTAssertFalse(presentation.didDismiss())
    }

    private var mirror: LocalMirrorRepository!
    private var outbox: SyncOutboxRepository!
    private var drafts: DraftRepository!
    private let scope = "https://demo|user"

    override func setUpWithError() throws {
        let db = try AppDatabase.makeEmpty()
        mirror = LocalMirrorRepository(dbQueue: db)
        outbox = SyncOutboxRepository(dbQueue: db)
        drafts = DraftRepository(dbQueue: db)
        try mirror.applyBootstrapBatch(
            scope: scope,
            notebooks: [
                Notebook(
                    id: "nb1",
                    parentId: nil,
                    name: "Inbox",
                    slug: nil,
                    icon: nil,
                    color: nil,
                    sortOrder: 0,
                    memoCount: 0,
                    lastMemoUpdatedAt: nil,
                    createdAt: EdgeEverDate.nowString(),
                    updatedAt: EdgeEverDate.nowString()
                ),
            ],
            memos: []
        )
    }

    func testIsMaterializedServerId() {
        XCTAssertFalse(MemoCreateCommit.isMaterializedServerId(nil))
        XCTAssertFalse(MemoCreateCommit.isMaterializedServerId(""))
        XCTAssertFalse(MemoCreateCommit.isMaterializedServerId("local:abc"))
        XCTAssertTrue(MemoCreateCommit.isMaterializedServerId("srv-memo-1"))
        XCTAssertTrue(MemoCreateCommit.isMaterializedServerId("uuid-without-local-prefix"))
    }

    func testDoneWithoutMaterializeEnqueuesCreateNotUpdate() throws {
        let outcome = try MemoCreateCommit.commit(
            scope: scope,
            memoId: nil,
            expectedRevision: nil,
            expectedContentHash: nil,
            notebookId: "nb1",
            title: "Draft title",
            contentMarkdown: "body",
            contentJSON: nil,
            tags: ["a"],
            mirror: mirror,
            outbox: outbox,
            drafts: drafts
        )
        guard case .createdLocal(let id) = outcome else {
            return XCTFail("expected createdLocal, got \(outcome)")
        }
        XCTAssertTrue(id.hasPrefix("local:"), "offline create uses local: id")

        let items = try outbox.listItems(scope: scope)
        XCTAssertEqual(items.count, 1)
        XCTAssertEqual(items[0].kind, .memoCreate)
        XCTAssertEqual(items[0].memoId, id)
        XCTAssertFalse(items.contains { $0.kind == .memoUpdate })

        let memo = try mirror.resolveMemo(scope: scope, id: id)
        XCTAssertEqual(memo?.title, "Draft title")
        XCTAssertEqual(memo?.contentMarkdown, "body")
    }

    /// Regression: insert image → materialize sets server memoId → Done must update, not second create.
    func testDoneAfterMaterializeUpdatesExistingMemoDoesNotCreateSecond() throws {
        let serverId = "server-memo-materialized"
        let now = EdgeEverDate.nowString()
        // Simulate materializeForImage: server memo already in mirror with revision/hash.
        var materialized = MemoDetail.localPlaceholder(
            id: serverId,
            notebookId: "nb1",
            title: "Before image",
            contentMarkdown: "with image later",
            tags: [],
            createdAt: now
        )
        materialized.revision = 3
        materialized.contentHash = "hash-rev-3"
        try mirror.upsertMemo(scope: scope, memo: materialized)

        // New-note draft may still exist; commit must clear it.
        try drafts.write(
            scope: scope,
            draft: MemoDraft(
                draftKey: DraftRepository.newKey,
                title: "Before image",
                contentMarkdown: "with image later",
                contentJson: nil,
                notebookId: "nb1",
                tagsText: "",
                expectedRevision: nil,
                updatedAt: now
            )
        )

        let outcome = try MemoCreateCommit.commit(
            scope: scope,
            memoId: serverId,
            expectedRevision: 3,
            expectedContentHash: "hash-rev-3",
            notebookId: "nb1",
            title: "After Done",
            contentMarkdown: "with image later\n\n![](/api/v1/resources/x/blob)\n",
            contentJSON: nil,
            tags: ["img"],
            mirror: mirror,
            outbox: outbox,
            drafts: drafts
        )
        XCTAssertEqual(outcome, .updatedMaterialized(memoId: serverId))

        let items = try outbox.listItems(scope: scope)
        XCTAssertEqual(items.count, 1, "only one outbox op for the materialized memo")
        XCTAssertEqual(items[0].kind, .memoUpdate, "must update, not create a second note")
        XCTAssertEqual(items[0].memoId, serverId)
        XCTAssertFalse(items.contains { $0.kind == .memoCreate }, "no second create after materialize")
        XCTAssertFalse(items.contains { $0.memoId.hasPrefix("local:") }, "must not mint local: twin")

        let updated = try mirror.resolveMemo(scope: scope, id: serverId)
        XCTAssertEqual(updated?.title, "After Done")
        XCTAssertTrue(updated?.contentMarkdown.contains("resources/x") == true)
        XCTAssertEqual(updated?.tags, ["img"])

        // No twin local: memo left in mirror from commit
        let all = try mirror.listMemos(scope: scope, params: LocalMemoListParams(filter: .all))
        XCTAssertEqual(all.memos.count, 1)
        XCTAssertEqual(all.memos.first?.id, serverId)

        let draft = try drafts.read(scope: scope, key: DraftRepository.newKey)
        XCTAssertNil(draft, "new-note draft cleared on Done")
    }

    func testDoneRejectsEmptyNotebook() {
        XCTAssertThrowsError(
            try MemoCreateCommit.commit(
                scope: scope,
                memoId: nil,
                expectedRevision: nil,
                expectedContentHash: nil,
                notebookId: "",
                title: "x",
                contentMarkdown: "y",
                contentJSON: nil,
                tags: [],
                mirror: mirror,
                outbox: outbox,
                drafts: drafts
            )
        )
    }
}
