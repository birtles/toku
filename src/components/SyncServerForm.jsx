import React from 'react';
import CancelableTextbox from './CancelableTextbox.jsx';

export class SyncServerForm extends React.Component {
  static get propTypes() {
    return {
      server: React.PropTypes.string,
      onSubmit: React.PropTypes.func.isRequired,
      onCancel: React.PropTypes.func.isRequired,
    };
  }

  constructor(props) {
    super(props);

    this.state = { server: '' };
    [ 'handleServerChange', 'handleSubmit', 'handleCancel' ].forEach(
      handler => { this[handler] = this[handler].bind(this); }
    );
  }

  componentWillMount() {
    this.setState({ server: this.props.server });
  }

  componentWillReceiveProps(nextProps) {
    if (this.props.server !== nextProps.server) {
      this.setState({ server: nextProps.server });
    }
  }

  handleServerChange(value) {
    this.setState({ server: value });
  }

  handleSubmit(e) {
    e.preventDefault();
    this.props.onSubmit({ server: this.state.server });
  }

  handleCancel() {
    this.setState({ server: this.props.server });
    this.props.onCancel();
  }

  render() {
    return (
      <form name="sync-server-settings" onSubmit={this.handleSubmit}>
        <div className="input-group">
          <CancelableTextbox name="server" type="text" placeholder="Server name"
            className="form-input" size="40"
            value={this.state.server} onChange={this.handleServerChange} />
          <input type="button" name="submit" value="Ok"
            className="primary input-group-btn"
            onClick={this.handleSubmit} />
        </div>
        <input type="button" name="cancel" value="Cancel" className="link"
          onClick={this.handleCancel} />
      </form>
    );
  }
}

export default SyncServerForm;
