import React from 'react';
import PropTypes from 'prop-types';
import { Dispatch, connect } from 'react-redux';

import { Card, Note } from '../model';
import AddNoteButton from './AddNoteButton';
import EditCardToolbar from './EditCardToolbar';
import EditCardForm from './EditCardForm';
import EditCardNotFound from './EditCardNotFound';
import EditNoteForm from './EditNoteForm';
import EditorState from '../edit/EditorState';
import * as editActions from '../edit/actions';
import { EditState, EditFormState, FormId } from '../edit/reducer';
import * as routeActions from '../route/actions';

interface Props {
  forms: {
    active: EditFormState;
  };
  active: boolean;
  onEdit: (id: FormId, change: Partial<Card>) => void;
  onDelete: (id: FormId) => void;
}

export class EditCardScreen extends React.PureComponent<Props> {
  activeForm?: EditCardForm;

  static get propTypes() {
    return {
      forms: PropTypes.shape({
        active: PropTypes.shape({
          formId: PropTypes.any,
          editorState: PropTypes.symbol.isRequired,
          // eslint-disable-next-line react/forbid-prop-types
          card: PropTypes.object.isRequired,
          deleted: PropTypes.bool,
        }).isRequired,
      }),
      active: PropTypes.bool.isRequired,
      onEdit: PropTypes.func.isRequired,
      onDelete: PropTypes.func.isRequired,
    };
  }

  constructor(props: Props) {
    super(props);

    this.handleFormChange = this.handleFormChange.bind(this);
    this.handleDelete = this.handleDelete.bind(this);
  }

  componentDidMount() {
    if (this.props.active) {
      this.activate();
    }
  }

  componentDidUpdate(previousProps: Props) {
    if (this.props.active && previousProps.active !== this.props.active) {
      this.activate();
    }
  }

  activate() {
    if (
      this.props.forms.active.editorState === EditorState.EMPTY &&
      this.activeForm &&
      this.activeForm.questionTextBox
    ) {
      this.activeForm.questionTextBox.focus();
    }
  }

  handleFormChange<K extends keyof Card>(field: K, value: Card[K]) {
    this.props.onEdit(this.props.forms.active.formId, { [field]: value });
  }

  handleDelete() {
    this.props.onDelete(this.props.forms.active.formId);
  }

  render() {
    return (
      <section className="edit-screen" aria-hidden={!this.props.active}>
        <EditCardToolbar
          editorState={this.props.forms.active.editorState}
          onDelete={this.handleDelete}
        />
        {this.props.forms.active.editorState !== EditorState.NOT_FOUND ? (
          <>
            <EditCardForm
              onChange={this.handleFormChange}
              {...this.props.forms.active}
              ref={activeForm => {
                this.activeForm = activeForm || undefined;
              }}
            />
            <hr className="note-divider divider" />
            <EditNoteForm
              className="noteform"
              note={{}}
              relatedKeywords={['屯所', '屯']}
            />
            <AddNoteButton className="addnote" />
          </>
        ) : (
          <EditCardNotFound deleted={!!this.props.forms.active.deleted} />
        )}
      </section>
    );
  }
}

// XXX Convert to State once we've converted all reducers to TS
const mapStateToProps = (state: any) => ({
  forms: (state.edit as EditState).forms,
});
const mapDispatchToProps = (dispatch: Dispatch<any>) => ({
  onEdit: (formId: FormId, card: Partial<Card>) => {
    dispatch(editActions.editCard(formId, card));
  },
  onDelete: (formId: FormId) => {
    dispatch(editActions.deleteEditCard(formId));
    dispatch(routeActions.followLink('/'));
  },
});

export default connect(mapStateToProps, mapDispatchToProps)(EditCardScreen);
