/* global describe, it */
/* eslint-disable react/jsx-first-prop-new-line */
/* eslint-disable react/jsx-max-props-per-line */

import React from 'react';
import { configure, shallow } from 'enzyme';
import { assert } from 'chai';
import sinon from 'sinon';
import Adapter from 'enzyme-adapter-react-16';
import SyncState from '../../src/sync/states';
import SyncSettingsPanel from '../../src/components/SyncSettingsPanel.jsx';

configure({ adapter: new Adapter() });
sinon.assert.expose(assert, { prefix: '' });

global.document = {
  addEventListener: () => {},
};

describe('<SyncSettingsPanel />', () => {
  const stub = sinon.stub();

  // -------------------------------------------------------------
  //
  // Common properties
  //
  // -------------------------------------------------------------

  it('has a summary label in all states', () => {
    const subject = shallow(
      <SyncSettingsPanel
        syncState={SyncState.NOT_CONFIGURED}
        onSubmit={stub}
        onRetry={stub}
        onEdit={stub}
        onCancel={stub}
        onPause={stub}
        onResume={stub}
      />
    );
    for (const state of Object.keys(SyncState)) {
      subject.setProps({ syncState: SyncState[state] });
      subject.update();
      assert.isAbove(
        subject.find('.heading').text().length,
        0,
        `Summary label is filled-in in ${state} state`
      );
    }
  });

  it('shows the last updated information state', () => {
    const subject = shallow(
      <SyncSettingsPanel
        syncState={SyncState.OK}
        onSubmit={stub}
        onRetry={stub}
        onEdit={stub}
        onCancel={stub}
        onPause={stub}
        onResume={stub}
        lastSyncTime={new Date()}
      />
    );

    for (const state of ['OK', 'PAUSED', 'ERROR', 'OFFLINE']) {
      subject.setProps({ syncState: SyncState[state] });
      assert.instanceOf(
        subject.find('ServerStatus').prop('lastSyncTime'),
        Date,
        `Last updated information is filled-in in the ${state} state`
      );
    }
  });

  // -------------------------------------------------------------
  //
  // Server add/change form
  //
  // -------------------------------------------------------------

  it('calls the edit callback when the Add/Change button is clicked', () => {
    const onEdit = sinon.spy();
    const subject = shallow(
      <SyncSettingsPanel
        syncState={SyncState.NOT_CONFIGURED}
        onSubmit={stub}
        onRetry={stub}
        onEdit={onEdit}
        onCancel={stub}
        onPause={stub}
        onResume={stub}
      />
    );

    subject.find('button[name="edit-server"]').simulate('click');

    assert.calledOnce(onEdit);
  });

  it('calls the cancel callback when the Cancel button is clicked', () => {
    const onCancel = sinon.spy();
    const subject = shallow(
      <SyncSettingsPanel
        syncState={SyncState.NOT_CONFIGURED}
        onSubmit={stub}
        onRetry={stub}
        onEdit={stub}
        onCancel={onCancel}
        onPause={stub}
        onResume={stub}
        editingServer
      />
    );

    subject.find('SyncServerForm').prop('onCancel')();
    subject.update();

    assert.calledOnce(onCancel);
  });

  it('calls the callback when the server is edited', () => {
    const onSubmit = sinon.spy();
    const subject = shallow(
      <SyncSettingsPanel
        syncState={SyncState.NOT_CONFIGURED}
        onSubmit={onSubmit}
        onRetry={stub}
        onEdit={stub}
        onCancel={stub}
        onPause={stub}
        onResume={stub}
        editingServer
      />
    );

    subject.find('SyncServerForm').prop('onSubmit')({ name: 'abc' });

    assert.calledWith(onSubmit, { name: 'abc' });
  });

  // -------------------------------------------------------------
  //
  // In progress state
  //
  // -------------------------------------------------------------

  it("shows a progress bar in 'in progress' state", () => {
    const subject = shallow(
      <SyncSettingsPanel
        syncState={SyncState.IN_PROGRESS}
        onSubmit={stub}
        onRetry={stub}
        onEdit={stub}
        onCancel={stub}
        onPause={stub}
        onResume={stub}
      />
    );

    assert.strictEqual(subject.find('progress').length, 1);
  });

  it('does NOT show progress bar in other states', () => {
    const subject = shallow(
      <SyncSettingsPanel
        syncState={SyncState.IN_PROGRESS}
        onSubmit={stub}
        onRetry={stub}
        onEdit={stub}
        onCancel={stub}
        onPause={stub}
        onResume={stub}
      />
    );
    for (const state of Object.keys(SyncState)) {
      if (state === 'IN_PROGRESS') {
        continue;
      }

      subject.setProps({ syncState: SyncState[state] });
      assert.strictEqual(
        subject.find('progress').length,
        0,
        `There should be no progress bar in the ${state} state`
      );
    }
  });

  it('pauses syncing when the Cancel button is clicked', () => {
    const onPause = sinon.spy();
    const subject = shallow(
      <SyncSettingsPanel
        syncState={SyncState.IN_PROGRESS}
        onSubmit={stub}
        onRetry={stub}
        onEdit={stub}
        onCancel={stub}
        onPause={onPause}
        onResume={stub}
      />
    );

    subject.find('button[name="cancel-sync"]').simulate('click');

    assert.calledOnce(onPause);
  });

  // -------------------------------------------------------------
  //
  // Error state
  //
  // -------------------------------------------------------------

  it("shows the error information in 'error' state", () => {
    const errorMessage = { message: 'Oh dear' };
    const subject = shallow(
      <SyncSettingsPanel
        syncState={SyncState.ERROR}
        onSubmit={stub}
        onRetry={stub}
        onEdit={stub}
        onCancel={stub}
        onPause={stub}
        onResume={stub}
        errorDetail={errorMessage}
      />
    );

    assert.equal(
      subject.find('.error-details').text(),
      'Oh dear',
      'Error message is filled-in'
    );
  });

  // XXX Add tests for the play/pause button and icon state
});
