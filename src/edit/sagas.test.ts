/**
 * @jest-environment node
 *
 * Why this? See my complaint about jest in ../route/sagas.test.js
 */

import { expectSaga } from 'redux-saga-test-plan';

import {
  navigate as navigateSaga,
  watchCardEdits as watchCardEditsSaga,
  save as saveSaga,
  beforeEditScreenChange as beforeEditScreenChangeSaga,
} from './sagas';
import { Card } from '../model';
import { DataStore } from '../store/DataStore';
import { SaveState } from './reducer';
import { reducer, AppState } from '../reducer';
import { FormState } from './FormState';
import * as Actions from '../actions';
import { generateCard } from '../utils/testing';

declare global {
  namespace NodeJS {
    interface Global {
      location: {
        pathname?: string;
        search?: string;
        hash?: string;
      };
    }
  }
}

const loadingState = (formId: number) => ({
  edit: {
    forms: {
      active: {
        formId,
        formState: FormState.Loading,
        card: {},
      },
    },
    newCardTags: [],
  },
});

const dirtyState = (formId: number, cardToUse: Partial<Card> | undefined) => {
  const card = cardToUse || { front: 'Updated', back: 'Answer' };
  return {
    route: { index: 0 },
    edit: {
      forms: {
        active: {
          formId,
          formState: FormState.Ok,
          card,
          dirtyFields: new Set(['front']),
        },
      },
      newCardTags: [],
    },
  };
};

const initialState = reducer(undefined, { type: 'none' } as any);

describe('sagas:edit navigate', () => {
  it('triggers a load action if the route is for editing a card (URL)', () => {
    const dataStore = ({
      getCard: (id: string) => ({ id }),
    } as unknown) as DataStore;

    // The load action increments a global counter so we need to read where it
    // is up to.
    const formId = Actions.loadCard('123').newFormId + 1;

    return expectSaga(
      navigateSaga,
      dataStore,
      Actions.navigate({ url: '/cards/123' })
    )
      .withState(initialState)
      .put(Actions.loadCard('123', formId))
      .call([dataStore, 'getCard'], '123')
      .run();
  });

  it('triggers a load action if the route is for editing a card (path)', () => {
    const dataStore = ({
      getCard: (id: string) => ({ id }),
    } as unknown) as DataStore;
    const formId = Actions.loadCard('123').newFormId + 1;

    return expectSaga(
      navigateSaga,
      dataStore,
      Actions.navigate({ path: '/cards/123' })
    )
      .withState(initialState)
      .put(Actions.loadCard('123', formId))
      .call([dataStore, 'getCard'], '123')
      .run();
  });

  it('triggers a new action if the route is for adding a card', () => {
    const dataStore = ({
      getCard: (id: string) => ({ id }),
    } as unknown) as DataStore;
    const formId = Actions.newCard().newFormId + 1;

    return expectSaga(
      navigateSaga,
      dataStore,
      Actions.navigate({ url: '/cards/new' })
    )
      .put(Actions.newCard(undefined, formId))
      .not.call.fn(dataStore.getCard)
      .run();
  });

  it('includes any query string parameters in a triggered new action', () => {
    const dataStore = ({
      getCard: (id: string) => ({ id }),
    } as unknown) as DataStore;
    const formId = Actions.newCard().newFormId + 1;

    return expectSaga(
      navigateSaga,
      dataStore,
      Actions.navigate({
        url: '/cards/new?front=ABC&back=DEF',
      })
    )
      .put(Actions.newCard({ front: 'ABC', back: 'DEF' }, formId))
      .run();
  });

  it('handles array query string parameters for the new card route', () => {
    const dataStore = ({
      getCard: (id: string) => ({ id }),
    } as unknown) as DataStore;
    const formId = Actions.newCard().newFormId + 1;

    return expectSaga(
      navigateSaga,
      dataStore,
      Actions.navigate({
        url: '/cards/new?keywords=1&tags=tag&keywords&keywords=2&keywords=3',
      })
    )
      .put(
        Actions.newCard({ keywords: ['1', '2', '3'], tags: ['tag'] }, formId)
      )
      .run();
  });

  it('ignores irrelevant fields in the new card route', () => {
    const dataStore = ({
      getCard: (id: string) => ({ id }),
    } as unknown) as DataStore;
    const formId = Actions.newCard().newFormId + 1;

    return expectSaga(
      navigateSaga,
      dataStore,
      Actions.navigate({
        url: '/cards/new?modified=12345&front=hello&progress=5',
      })
    )
      .put(Actions.newCard({ front: 'hello' }, formId))
      .run();
  });

  it('takes just the last element for string fields specified as arrays', () => {
    const dataStore = ({
      getCard: (id: string) => ({ id }),
    } as unknown) as DataStore;
    const formId = Actions.newCard().newFormId + 1;

    return expectSaga(
      navigateSaga,
      dataStore,
      Actions.navigate({
        url:
          '/cards/new?front=Front%20One&front=Front%20Two&back=Back%20One&back=Back%20Two',
      })
    )
      .put(Actions.newCard({ front: 'Front Two', back: 'Back Two' }, formId))
      .run();
  });

  it('ignores does not get tripped up on commas in the new card route', () => {
    const dataStore = ({
      getCard: (id: string) => ({ id }),
    } as unknown) as DataStore;
    const formId = Actions.newCard().newFormId + 1;

    return expectSaga(
      navigateSaga,
      dataStore,
      Actions.navigate({
        url: '/cards/new?front=hello,mate&keywords=one,two',
      })
    )
      .put(
        Actions.newCard({ front: 'hello,mate', keywords: ['one,two'] }, formId)
      )
      .run();
  });

  it('does not triggers a load action if the route is something else', () => {
    const dataStore = ({
      getCard: (id: string) => ({ id }),
    } as unknown) as DataStore;
    const formId = Actions.loadCard('123').newFormId + 1;

    return expectSaga(navigateSaga, dataStore, Actions.navigate({ url: '/' }))
      .not.put(Actions.loadCard('123', formId))
      .not.call([dataStore, 'getCard'], '123')
      .run();
  });

  it('dispatches a finished action if the load successfully complete', () => {
    const card = generateCard('123');
    const dataStore = ({
      getCard: (id: string) => ({ ...card, id }),
    } as unknown) as DataStore;
    const formId = Actions.loadCard('123').newFormId + 1;

    return expectSaga(
      navigateSaga,
      dataStore,
      Actions.navigate({ url: '/cards/123' })
    )
      .put(Actions.loadCard('123', formId))
      .call([dataStore, 'getCard'], '123')
      .withState(loadingState(formId))
      .put(Actions.finishLoadCard(formId, card))
      .run();
  });

  it('dispatches a failed action if the load failed to complete', () => {
    const error = { status: 404, name: 'not_found', message: 'Not found' };
    const dataStore = ({
      getCard: () =>
        new Promise((resolve, reject) => {
          reject(error);
        }),
    } as unknown) as DataStore;
    const formId = Actions.loadCard('123').newFormId + 1;

    return expectSaga(
      navigateSaga,
      dataStore,
      Actions.navigate({ url: '/cards/123' })
    )
      .put(Actions.loadCard('123', formId))
      .call([dataStore, 'getCard'], '123')
      .withState(loadingState(formId))
      .put(Actions.failLoadCard(formId, error))
      .silentRun(100);
  });
});

const okState = (
  formId: number,
  cardToUse: Partial<Card> | undefined
): AppState => {
  const card: Partial<Card> = cardToUse || {
    front: 'Prompt',
    back: 'Answer',
  };
  return {
    ...initialState,
    edit: {
      forms: {
        active: {
          formId,
          formState: FormState.Ok,
          card,
          notes: [],
          saveState: SaveState.Ok,
        },
      },
      newCardTags: [],
    },
  };
};

const emptyState = (formId: number) => ({
  edit: {
    forms: {
      active: {
        formId,
        formState: FormState.Ok,
        card: {},
      },
    },
    newCardTags: [],
  },
});

const deletedState = (formId: number) => ({
  edit: {
    forms: {
      active: {
        formId,
        formState: FormState.Deleted,
        card: {},
      },
    },
    newCardTags: [],
  },
});

describe('sagas:edit watchCardEdits', () => {
  beforeEach(() => {
    global.location = {
      pathname: '',
      search: '',
      hash: '',
    };
  });

  it('saves the card', () => {
    const dataStore = ({
      putCard: (card: Partial<Card>) => card,
    } as unknown) as DataStore;
    const card = { front: 'yer' };
    const formId = 5;

    return expectSaga(watchCardEditsSaga, dataStore)
      .withState(dirtyState(formId, card))
      .dispatch(Actions.saveCard(formId))
      .call([dataStore, 'putCard'], card)
      .put(Actions.finishSaveCard(formId, card))
      .silentRun(100);
  });

  it('does NOT save the card if it is not dirty', () => {
    const dataStore = ({
      putCard: (card: Partial<Card>) => card,
    } as unknown) as DataStore;
    const card = { front: 'yer' };
    const formId = 5;

    return expectSaga(watchCardEditsSaga, dataStore)
      .withState(okState(formId, card))
      .dispatch(Actions.saveCard(formId))
      .not.call([dataStore, 'putCard'], card)
      .put(Actions.finishSaveCard(formId, card))
      .silentRun(100);
  });

  it('fails if there is no card to save', () => {
    const dataStore = ({
      putCard: (card: Partial<Card>) => card,
    } as unknown) as DataStore;
    const formId = 5;

    return expectSaga(watchCardEditsSaga, dataStore)
      .withState(emptyState(formId))
      .dispatch(Actions.saveCard(formId))
      .not.call([dataStore, 'putCard'], {})
      .not.put(
        Actions.failSaveCard(formId, {
          name: 'no_card',
          message: 'No card to save',
        })
      )
      .silentRun(100);
  });

  it('reports the ID of the saved card', () => {
    const dataStore = ({
      putCard: (card: Partial<Card>) => ({ ...card, id: 'generated-id' }),
    } as unknown) as DataStore;
    const card = { front: 'yer' };
    const formId = 5;

    return expectSaga(watchCardEditsSaga, dataStore)
      .withState(dirtyState(formId, card))
      .dispatch(Actions.saveCard(formId))
      .call([dataStore, 'putCard'], card)
      .put(Actions.finishSaveCard(formId, { ...card, id: 'generated-id' }))
      .silentRun(100);
  });

  it('updates the history so the current URL reflects the saved card', () => {
    const dataStore = ({
      putCard: (card: Partial<Card>) => ({ ...card, id: '1234' }),
    } as unknown) as DataStore;
    const card = { front: 'yer' };
    const formId = 5;
    global.location.pathname = '/cards/new';

    return expectSaga(watchCardEditsSaga, dataStore)
      .withState(dirtyState(formId, card))
      .dispatch(Actions.saveCard(formId))
      .call([dataStore, 'putCard'], card)
      .put(Actions.finishSaveCard(formId, { ...card, id: '1234' }))
      .put(Actions.updateUrl('/cards/1234'))
      .silentRun(100);
  });

  it('does NOT update history if the card is not new', () => {
    const dataStore = ({
      putCard: (card: Partial<Card>) => card,
    } as unknown) as DataStore;
    const card = { front: 'yer', id: '1234' };
    const formId = 5;
    global.location.pathname = '/cards/new';

    return expectSaga(watchCardEditsSaga, dataStore)
      .withState(dirtyState(formId, card))
      .dispatch(Actions.saveCard(formId))
      .call([dataStore, 'putCard'], card)
      .put(Actions.finishSaveCard(formId, card))
      .not.put(Actions.updateUrl('/cards/1234'))
      .silentRun(100);
  });

  it('does NOT update history if we are no longer on the new card screen', () => {
    const dataStore = ({
      putCard: (card: Partial<Card>) => ({ ...card, id: '2345' }),
    } as unknown) as DataStore;
    const card = { front: 'yer' };
    const formId = 18;
    global.location.pathname = '/';

    return expectSaga(watchCardEditsSaga, dataStore)
      .withState(dirtyState(formId, card))
      .dispatch(Actions.saveCard(formId))
      .call([dataStore, 'putCard'], card)
      .put(Actions.finishSaveCard(formId, { ...card, id: '2345' }))
      .not.put(Actions.updateUrl('/cards/2345'))
      .silentRun(100);
  });

  it('dispatches a failed action when the card cannot be saved', () => {
    const error = { status: 404, name: 'not_found', message: 'Not found' };
    const dataStore = ({
      putCard: () =>
        new Promise((resolve, reject) => {
          reject(error);
        }),
    } as unknown) as DataStore;
    const card = { front: 'yer' };
    const formId = 13;

    return expectSaga(watchCardEditsSaga, dataStore)
      .withState(dirtyState(formId, card))
      .dispatch(Actions.saveCard(formId))
      .call([dataStore, 'putCard'], card)
      .put(Actions.failSaveCard(formId, error))
      .silentRun(100);
  });

  it('deletes the card when requested', () => {
    const dataStore = ({ deleteCard: () => {} } as unknown) as DataStore;
    const formId = 5;

    return expectSaga(watchCardEditsSaga, dataStore)
      .withState(deletedState(formId))
      .dispatch(Actions.deleteCard(formId, 'abc'))
      .call([dataStore, 'deleteCard'], 'abc')
      .silentRun(100);
  });

  it('deletes the card even if it has not been saved', () => {
    const dataStore = ({ deleteCard: () => {} } as unknown) as DataStore;
    const card = { id: 'abc', front: 'Prompt', back: 'Answer' };
    const formId = 5;

    return expectSaga(watchCardEditsSaga, dataStore)
      .withState(dirtyState(formId, card))
      .dispatch(Actions.deleteCard(formId, 'abc'))
      .call([dataStore, 'deleteCard'], 'abc')
      .silentRun(100);
  });

  it('ignores any errors when deleting', () => {
    const error = { status: 404, name: 'not_found', reason: 'deleted' };
    const dataStore = ({
      deleteCard: () =>
        new Promise((resolve, reject) => {
          reject(error);
        }),
    } as unknown) as DataStore;
    const formId = 5;

    return expectSaga(watchCardEditsSaga, dataStore)
      .withState(deletedState(formId))
      .dispatch(Actions.deleteCard(formId, 'abc'))
      .call([dataStore, 'deleteCard'], 'abc')
      .silentRun(100);
  });

  it('cancels autosaving when the card is deleted', () => {
    const dataStore = ({
      deleteCard: () => {},
      putCard: () => {},
    } as unknown) as DataStore;
    const card = { id: 'abc', front: 'Question', back: 'Answer' };
    const formId = 5;

    return expectSaga(watchCardEditsSaga, dataStore)
      .withReducer(reducer)
      .withState(okState(formId, card))
      .dispatch(Actions.editCard(formId, { ...card, back: 'Updated answer' }))
      .dispatch(Actions.deleteCard(formId, 'abc'))
      .not.call.fn(dataStore.putCard)
      .silentRun(500);
  });

  it('deletes the card even if the initial save is in progress', () => {
    const dataStore = ({
      putCard: async (card: Partial<Card>) => {
        // This needs to take a tick or two so that the delete runs before we
        // finish saving.
        return new Promise(resolve => {
          setImmediate(() => {
            resolve({ ...card, id: 'abc' });
          });
        });
      },
      deleteCard: () => {},
    } as unknown) as DataStore;
    const card = { front: 'Question', back: 'Answer' };
    const formId = 5;

    return expectSaga(watchCardEditsSaga, dataStore)
      .withReducer(reducer, okState(formId, card))
      .dispatch(Actions.editCard(formId, { ...card, back: 'Updated answer' }))
      .dispatch(Actions.saveCard(formId))
      .dispatch(Actions.deleteCard(formId))
      .call([dataStore, 'putCard'], { ...card, back: 'Updated answer' })
      .call([dataStore, 'deleteCard'], 'abc')
      .silentRun(100);
  });
});

// This is largely covered by the watchCardEditsSaga tests above but there are
// a few things we can't test there with redux-test-plan (like changing state
// mid-course).
describe('sagas:edit save', () => {
  it('does NOT update history if the app is navigated while saving', () => {
    const dataStore = ({
      putCard: (card: Partial<Card>) => ({ ...card, id: '4567' }),
    } as unknown) as DataStore;
    const card = { front: 'yer' };
    const oldFormId = 17;
    const newFormId = 18;

    return expectSaga(saveSaga, dataStore, oldFormId, card)
      .withState(emptyState(newFormId))
      .call([dataStore, 'putCard'], card)
      .put(Actions.finishSaveCard(oldFormId, { ...card, id: '4567' }))
      .not.put(Actions.updateUrl('/cards/4567'))
      .silentRun(100);
  });
});

describe('sagas:edit beforeEditScreenChange', () => {
  it('dispatches SAVE_CARD if the card is dirty', () => {
    const formId = 5;
    const state = {
      edit: {
        forms: {
          active: {
            formId,
            formState: FormState.Ok,
            dirtyFields: new Set(['back']),
            notes: [],
          },
        },
      },
    };

    return expectSaga(beforeEditScreenChangeSaga)
      .withState(state)
      .put(Actions.saveCard(formId))
      .dispatch(Actions.finishSaveCard(formId, {}))
      .returns(true)
      .run();
  });

  it('does nothing if the card is not dirty', () => {
    const formId = 5;
    const state = {
      edit: {
        forms: { active: { formId, formState: FormState.Ok, notes: [] } },
      },
    };

    return expectSaga(beforeEditScreenChangeSaga)
      .withState(state)
      .not.put(Actions.saveCard(formId))
      .returns(true)
      .run();
  });

  it('returns false if the card fails to save', () => {
    const formId = 5;
    const state = {
      edit: {
        forms: {
          active: {
            formId,
            formState: FormState.Ok,
            dirtyFields: new Set(['back']),
            notes: [],
          },
        },
      },
    };
    const error = { name: 'too_bad', message: 'too bad' };

    return expectSaga(beforeEditScreenChangeSaga)
      .withState(state)
      .put(Actions.saveCard(formId))
      .dispatch(Actions.failSaveCard(formId, error))
      .returns(false)
      .run();
  });
});
