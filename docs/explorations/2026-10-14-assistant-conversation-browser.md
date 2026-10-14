# Assistant conversation browsing

## Task and direction

The conversation view used a native select followed by a large fieldset of
storage and deletion buttons. Picking an earlier chat was visually secondary
to data administration. The sidebar now gives its main space to finding and
reopening conversations.

The design uses a restrained list with one shared text spine, local search,
recent date groups, timestamps and a textual current-conversation marker.
Deletion is a compact trailing action, available without hover. Storage tools
are a native disclosure below the list. The existing header continues to own
new-conversation creation and navigation.

References checked:

- [ChatGPT search](https://help.openai.com/en/articles/10056348-finding-your-chats-projects-and-files-in-chatgpt)
  documents matching conversation titles and messages and reopening a result.
- [Claude conversation management](https://support.claude.com/en/articles/8230524-delete-or-rename-a-conversation)
  documents row-scoped management and a second explicit deletion action.

This borrows the interaction hierarchy and retains this project's browser-local
storage model. It does not add account synchronization, archiving or another
persistence format.

## Ownership and safeguards

`history-list.ts` renders the existing conversation store and emits select or
request-delete events. `history-controls.ts` continues to own opt-in, export,
legacy import, restore and deletion confirmation. The panel owns switching,
controller invalidation and draft preservation. Search reads local message
content only; it performs no network requests.

A row deletion names its target before confirmation, including a non-current
conversation. Cancel returns focus to that row. After deleting the focused row,
focus returns to search. Escape cancels the topmost deletion decision first;
a later Escape returns to chat. Pending deletion cannot be cancelled after its
storage operation has started. Existing storage failure and revision-conflict
handling remain in place. A storage failure automatically opens the data
disclosure so its error remains visible even when a row deletion closes its
confirmation. Chinese and Korean confirmation copy names this conversation,
not the current conversation.

## Verification

- Focused Vitest coverage includes the list, data controls, panel, model loading,
  writing replies, sessions and all locale tables.
- Regression proof: the old layout failed assertions for the searchable list
  and collapsed management disclosure. Temporarily disabling query filtering
  made the title/message search test fail (two results instead of one).
- Collapsed-disclosure row deletion tests reproduce both revision conflicts
  and storage failures; they failed before error reporting opened the disclosure.
  Focus returns to search when the deleted trigger has been removed.
- The row-target confirmation test failed without the target's title. Escape
  cancellation failed before the local confirmation key handler was added.
- The real-editor Playwright path restores 400 messages, searches message text,
  verifies an empty result, switches both conversations, cancels and confirms
  deletion of the inactive conversation, preserves the draft and verifies focus.
- Geometry assertions check that the sidebar title, history heading and list
  title share the same leading edge, and that a 360px viewport has no horizontal
  overflow. Light, dark and narrow-view screenshots were inspected.
- Lint and workspace/application TypeScript validation pass.

## Design and accessibility review

Task, hierarchy and scope: checked against the rendered editor panel and the
select/delete flows. Geometry, tokens and typography: checked with layout
assertions and screenshots; existing ranui tokens provide theme, sizes, spacing
and color. Keyboard, focus, accessible names, empty state and destructive
feedback: covered by the component and editor tests. The current marker is text
as well as a row fill. Pointer targets remain 32px and metadata uses 12px type.

Storage busy, failure and opt-in states are covered by existing controls tests.
Seven locale tables remain complete; every language was not separately visually
reviewed. Screen-reader output and high browser zoom were not manually audited.
Motion is not introduced. Offline behavior uses the existing local store and
has no new transport. GPUI-native window, action and component APIs do not apply
to this browser UI; the repository's ranui and web interaction conventions take
precedence.
