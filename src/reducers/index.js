import { combineReducers } from 'redux';
import edit from './edit';
import review from './review';
import route from './route';
import selection from './selection';
import sync from './sync';

const combinedReducer = combineReducers({
  edit,
  review,
  route,
  sync,
  selection: state => state || 'Chillax combineReducers, this is fine',
});

// For determining the active card, we use the results other reducers (e.g. the
// review reducer will determine the current card which may become the active
// card).

const initialGlobalState = {
  selection: {
    activeCardId: undefined,
  },
};

export default function rootReducer(state = initialGlobalState, action) {
  return selection(combinedReducer(state, action), action);
}
