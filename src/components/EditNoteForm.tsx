import * as React from 'react';
import memoize from 'memoize-one';

import { Note } from '../model';
import { SaveState } from '../edit/reducer';
import { getKeywordVariants, getKeywordsToMatch } from '../text/keywords';
import { NoteFrame } from './NoteFrame';
import { SaveStatus } from './SaveStatus';
import { TokenList } from './TokenList';
import { ContentState, Editor, EditorState } from 'draft-js';
import { KeywordSuggestionProvider } from './KeywordSuggestionProvider';

interface Props {
  className?: string;
  formId: number;
  note: Partial<Note>;
  saveState: SaveState;
  saveError?: string;
  relatedKeywords: string[];
  onChange?: (
    noteFormId: number,
    topic: string,
    value: string | string[]
  ) => void;
  onDelete?: (noteFormId: number, noteId?: string) => void;
}

interface State {
  contentEditorState: EditorState;
  keywordText: string;
  keywordSuggestions: string[];
  loadingSuggestions: boolean;
}

const getEditorContent = (editorState: EditorState): string => {
  return editorState.getCurrentContent().getPlainText();
};

const hasCommonKeyword = (
  keywordsA: Array<string>,
  keywordsB: Array<string>
): boolean => {
  const keywordSet = new Set<string>(getKeywordsToMatch(keywordsA));
  for (const keyword of getKeywordsToMatch(keywordsB)) {
    if (keywordSet.has(keyword)) {
      return true;
    }
  }
  return false;
};

export class EditNoteForm extends React.Component<Props, State> {
  state: State;
  editor?: Editor;
  keywordsTokenList?: TokenList;
  formRef: React.RefObject<HTMLFormElement>;
  hasCommonKeyword: (
    keywordsA: Array<string>,
    keywordsB: Array<string>
  ) => boolean;

  constructor(props: Props) {
    super(props);

    this.state = {
      contentEditorState: EditorState.createEmpty(),
      keywordText: '',
      keywordSuggestions: [],
      loadingSuggestions: false,
    };
    this.formRef = React.createRef<HTMLFormElement>();
    this.hasCommonKeyword = memoize(hasCommonKeyword);

    // Content editor
    this.handleContentClick = this.handleContentClick.bind(this);
    this.handleContentChange = this.handleContentChange.bind(this);

    // Keyword suggestion feature
    this.handleKeywordsClick = this.handleKeywordsClick.bind(this);
    this.handleKeywordsChange = this.handleKeywordsChange.bind(this);
    this.handleKeywordsTextChange = this.handleKeywordsTextChange.bind(this);

    this.handleDeleteClick = this.handleDeleteClick.bind(this);
  }

  componentDidMount() {
    if (this.props.note.content) {
      this.updateContent(this.props.note.content);
    }
  }

  componentDidUpdate(previousProps: Props) {
    // We'd like to do this in getStateFromDerivedProps but we can't since we
    // end up with the following flow:
    //
    //  - User changes text
    //  - handleContentChange
    //  - Update editor state
    //  - Call onChange which dispatches the appropriate action and updates the
    //    redux state
    //  - getStateFromDerivedProps is called for the *state* change
    //  - getStateFromDerivedProps is called for the *props* change (as a result
    //    of updating the redux state)
    //
    // So in the first call to getStateFromDerivedProps we end up with updated
    // state, but not updated props, so we detect a change and go to update the
    // editor state (since we can only assume that props have changed, e.g. due
    // to a sync, since they don't match the state).
    if (previousProps.note.content !== this.props.note.content) {
      this.updateContent(this.props.note.content);
    }
  }

  updateContent(content?: string) {
    // Setting editorState can reset the selection so we should avoid doing it
    // when the content hasn't changed (since it can interrupt typing).
    const currentValue = getEditorContent(this.state.contentEditorState);
    if (currentValue === content) {
      return;
    }

    const contentState = ContentState.createFromText(content || '');
    // Ok, so insert-characters is not quite right, but it's good enough for now
    // until we implement proper rich text editing.
    const contentEditorState = EditorState.push(
      this.state.contentEditorState,
      contentState,
      'insert-characters'
    );

    this.setState({ contentEditorState });
  }

  handleContentClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!e.defaultPrevented && this.editor) {
      this.editor.focus();
    }
  }

  handleContentChange(editorState: EditorState) {
    // We defer calling |onChange| until the state is actually updated so that
    // if that triggers a call to updateContent we can successfully recognize it
    // as a redundant change and avoid re-setting the editor state.
    this.setState((prevState, props) => {
      if (props.onChange) {
        const valueAsString = getEditorContent(editorState);
        if (valueAsString !== this.props.note.content) {
          props.onChange(props.formId, 'content', valueAsString);
        }
      }

      return { contentEditorState: editorState };
    });
  }

  handleKeywordsClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!e.defaultPrevented && this.keywordsTokenList) {
      this.keywordsTokenList.focus();
    }
  }

  handleKeywordsTextChange(text: string) {
    this.setState({ keywordText: text });
  }

  handleKeywordsChange(keywords: string[], addedKeywords: string[]) {
    if (this.props.onChange) {
      this.props.onChange(this.props.formId, 'keywords', keywords);
    }
  }

  handleDeleteClick(e: React.MouseEvent<HTMLButtonElement>) {
    if (this.props.onDelete) {
      this.props.onDelete(this.props.formId, this.props.note.id);
    }
  }

  scrollIntoView() {
    if (this.formRef.current) {
      this.formRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }

  focus() {
    if (this.editor) {
      this.editor.focus();
    }
  }

  get form(): HTMLFormElement | null {
    return this.formRef.current;
  }

  render() {
    let className = 'editnote-form form';
    if (this.props.className) {
      className += ' ' + this.props.className;
    }

    const linkedTokens = [
      ...this.props.relatedKeywords,
      ...getKeywordVariants(this.props.relatedKeywords),
    ];

    let statusMessage: string | undefined;
    if (!this.props.note.keywords || !this.props.note.keywords.length) {
      statusMessage =
        'This note has no keywords. It will be lost unless some keywords are added.';
      className += ' -nokeywords';
    } else {
      if (
        !this.hasCommonKeyword(
          this.props.relatedKeywords,
          this.props.note.keywords
        )
      ) {
        statusMessage =
          'This note has no keywords that match the card. It will not be shown next time this card is viewed.';
        className += ' -nomatch';
      }
    }

    return (
      <form
        className={className}
        autoComplete="off"
        ref={this.formRef}
        data-form-id={this.props.formId}
      >
        <NoteFrame>
          <>
            <div className="heading">
              {(this.props.note.keywords || []).join(', ')}
            </div>
            <div
              className="keywords -yellow"
              onClick={this.handleKeywordsClick}
              title="Add words here to cross-reference with cards."
            >
              <span className="icon -key" />
              <KeywordSuggestionProvider
                text={this.state.keywordText}
                defaultSuggestions={this.props.relatedKeywords}
              >
                {(suggestions: string[], loading: boolean) => (
                  <TokenList
                    className="tokens -yellow -seamless -inline"
                    tokens={this.props.note.keywords}
                    placeholder="Keywords"
                    linkedTokens={linkedTokens}
                    linkedTooltip="This keyword links the note to the card"
                    onTokensChange={this.handleKeywordsChange}
                    onTextChange={this.handleKeywordsTextChange}
                    suggestions={suggestions}
                    loadingSuggestions={loading}
                    ref={e => {
                      this.keywordsTokenList = e || undefined;
                    }}
                  />
                )}
              </KeywordSuggestionProvider>
              <button
                className="button menu -icon -dotdotdot -yellow -borderless -nolabel -large"
                type="button"
                title="Menu"
              >
                Menu
              </button>
            </div>
          </>
          <div className="content" onClick={this.handleContentClick}>
            <Editor
              editorState={this.state.contentEditorState}
              onChange={this.handleContentChange}
              placeholder="Note"
              stripPastedStyles
              ref={editor => {
                this.editor = editor || undefined;
              }}
            />
          </div>
          <div className="controls">
            <button
              type="button"
              className="button delete -icon -delete -borderless -yellow"
              onClick={this.handleDeleteClick}
            >
              Discard
            </button>
          </div>
          {statusMessage ? <div className="status">{statusMessage}</div> : null}
        </NoteFrame>
        <SaveStatus
          className="savestate"
          saveState={this.props.saveState}
          saveError={this.props.saveError}
        />
      </form>
    );
  }
}
