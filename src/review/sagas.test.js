/* global describe, it, expect */
/* eslint arrow-body-style: [ 'off' ] */

import { expectSaga } from 'redux-saga-test-plan';
import * as matchers from 'redux-saga-test-plan/matchers';

import {
  updateHeap as updateHeapSaga,
  updateProgress as updateProgressSaga,
} from './sagas';
import * as reviewActions from './actions';
import reducer from '../reducer';

describe('sagas:review updateHeap', () => {
  const cardStore = {
    getCards: () => {},
    putReview: () => {},
  };

  const getCardStoreProvider = (newCards, overdueCards) => {
    return {
      call(effect, next) {
        if (effect.fn === cardStore.getCards) {
          const type = effect.args[0] ? effect.args[0].type : '';
          if (type === 'new') {
            return newCards;
          } else if (type === 'overdue') {
            return overdueCards;
          }
        }

        return next();
      },
    };
  };

  it('respects the limits set for a new review', async () => {
    const newCards = ['New card 1', 'New card 2'];
    const overdueCards = ['Overdue card 1', 'Overdue card 2', 'Overdue card 3'];
    const allCards = newCards.concat(overdueCards);
    const action = reviewActions.newReview(2, 3);

    return expectSaga(updateHeapSaga, cardStore, action)
      .provide(getCardStoreProvider(newCards, overdueCards))
      .withState(reducer(undefined, action))
      .call([cardStore, 'getCards'], { limit: 2, type: 'new' })
      .call([cardStore, 'getCards'], { limit: 1, type: 'overdue' })
      .put.like({ action: { type: 'REVIEW_LOADED', cards: allCards } })
      .run();
  });

  it('does not request more than the maximum number of cards even if the new card limit is greater', async () => {
    const newCards = ['New card 1', 'New card 2'];
    const action = reviewActions.newReview(3, 2);

    return expectSaga(updateHeapSaga, cardStore, action)
      .provide([[matchers.call.fn(cardStore.getCards), newCards]])
      .withState(reducer(undefined, action))
      .call([cardStore, 'getCards'], { limit: 2, type: 'new' })
      .not.call.fn([cardStore, 'getCards'])
      .put.like({ action: { type: 'REVIEW_LOADED', cards: newCards } })
      .run();
  });

  it('requests more cards if the are not enough new cards', async () => {
    const overdueCards = ['Overdue card 1', 'Overdue card 2', 'Overdue card 3'];
    const action = reviewActions.newReview(2, 3);

    return expectSaga(updateHeapSaga, cardStore, action)
      .provide(getCardStoreProvider([], overdueCards))
      .withState(reducer(undefined, action))
      .call([cardStore, 'getCards'], { limit: 2, type: 'new' })
      .call([cardStore, 'getCards'], { limit: 3, type: 'overdue' })
      .put.like({ action: { type: 'REVIEW_LOADED', cards: overdueCards } })
      .run();
  });

  it('respects the limits set for an updated review', async () => {
    let state = reducer(undefined, reviewActions.newReview(2, 3));
    const action = reviewActions.setReviewLimit(3, 5);
    state = reducer(state, action);
    state.review.newCardsInPlay = 2;
    state.review.completed = 2;

    const newCards = ['New card 3'];
    const overdueCards = ['Overdue card 3', 'Overdue card 4'];
    const allCards = newCards.concat(overdueCards);

    return expectSaga(updateHeapSaga, cardStore, action)
      .provide(getCardStoreProvider(newCards, overdueCards))
      .withState(state)
      .call([cardStore, 'getCards'], { limit: 1, type: 'new' })
      .call([cardStore, 'getCards'], {
        limit: 2,
        type: 'overdue',
        skipFailedCards: true,
      })
      .put.like({ action: { type: 'REVIEW_LOADED', cards: allCards } })
      .run();
  });

  it('respects the overall limit for an updated review', async () => {
    let state = reducer(undefined, reviewActions.newReview(2, 3));
    const action = reviewActions.setReviewLimit(2, 3);
    state = reducer(state, action);
    state.review.newCardsInPlay = 1;
    state.review.completed = 2;
    state.review.failedCardsLevel1 = [{}];

    return expectSaga(updateHeapSaga, cardStore, action)
      .withState(state)
      .not.call.fn([cardStore, 'getCards'])
      .not.call.fn([cardStore, 'getCards'])
      .put.like({ action: { type: 'REVIEW_LOADED', cards: [] } })
      .run();
  });

  it('respects the limits set for an updated review even when there are no slots left', async () => {
    let state = reducer(undefined, reviewActions.newReview(2, 3));
    const action = reviewActions.setReviewLimit(1, 2);
    state = reducer(state, action);
    state.review.newCardsInPlay = 2;
    state.review.completed = 2;

    return expectSaga(updateHeapSaga, cardStore, action)
      .withState(state)
      .not.call.fn([cardStore, 'getCards'])
      .not.call.fn([cardStore, 'getCards'])
      .put.like({ action: { type: 'REVIEW_LOADED', cards: [] } })
      .run();
  });

  it('skips failed cards when updating due to a change in review time', async () => {
    let state = reducer(undefined, reviewActions.newReview(0, 3));
    const action = reviewActions.setReviewTime(new Date());
    state = reducer(state, action);
    state.review.completed = 2;

    const overdueCards = ['Overdue card 3', 'Overdue card 4'];

    return expectSaga(updateHeapSaga, cardStore, action)
      .provide(getCardStoreProvider([], overdueCards))
      .withState(state)
      .call([cardStore, 'getCards'], {
        limit: 1,
        type: 'overdue',
        skipFailedCards: true,
      })
      .put.like({ action: { type: 'REVIEW_LOADED', cards: overdueCards } })
      .run();
  });

  it('does not put review loaded due to a change in review time if we are not reviewing', async () => {
    const state = reducer(undefined, { type: 'NOTHING' });
    const action = reviewActions.setReviewTime(new Date());

    return expectSaga(updateHeapSaga, cardStore, action)
      .provide(getCardStoreProvider({}, []))
      .withState(state)
      .not.put.like({ action: { type: 'REVIEW_LOADED' } })
      .run();
  });

  it('counts the current card as an occupied slot', async () => {
    let state = reducer(undefined, reviewActions.newReview(2, 3));
    const action = reviewActions.setReviewLimit(3, 4);
    state = reducer(state, action);
    state.review.newCardsInPlay = 2;
    state.review.completed = 2;
    state.review.currentCard = {};

    const newCards = ['New card 3'];

    return expectSaga(updateHeapSaga, cardStore, action)
      .provide([[matchers.call.fn(cardStore.getCards), newCards]])
      .withState(state)
      .call([cardStore, 'getCards'], { limit: 1, type: 'new' })
      .not.call.fn([cardStore, 'getCards'])
      .put.like({ action: { type: 'REVIEW_LOADED', cards: newCards } })
      .run();
  });

  it('saves the review state', async () => {
    const newCards = ['New card 1', 'New card 2'];
    const overdueCards = ['Overdue card 1', 'Overdue card 2', 'Overdue card 3'];
    const action = reviewActions.newReview(2, 3);

    return expectSaga(updateHeapSaga, cardStore, action)
      .provide(getCardStoreProvider(newCards, overdueCards))
      .withState(reducer(undefined, action))
      .call([cardStore, 'putReview'], {
        maxCards: 3,
        maxNewCards: 2,
        completed: 0,
        newCardsCompleted: 0,
        history: [],
        failedCardsLevel1: [],
        failedCardsLevel2: [],
      })
      .run();
  });
});

describe('sagas:review updateProgress', () => {
  const MS_PER_DAY = 1000 * 60 * 60 * 24;
  const cardStore = {
    putCard: card => card,
    putReview: () => {},
    deleteReview: () => {},
  };

  const getCards = (maxNewCards, maxExistingCards, reviewTime) => {
    const cards = new Array(Math.max(maxNewCards, maxExistingCards));
    for (let i = 0; i < cards.length; i++) {
      const newCard = i < maxNewCards;
      cards[i] = {
        _id: i,
        question: `Question ${i + 1}`,
        answer: `Answer ${i + 1}`,
        progress: {
          level: newCard ? 0 : 1,
          reviewed: newCard ? null : new Date(reviewTime - 3 * MS_PER_DAY),
        },
      };
    }
    return cards;
  };

  const reviewLoaded = (cards, seed1, seed2) => {
    const action = reviewActions.reviewLoaded(cards);
    action.currentCardSeed = seed1;
    action.nextCardSeed = seed2;
    return action;
  };

  const passCard = seed => {
    const action = reviewActions.passCard();
    action.nextCardSeed = seed;
    return action;
  };

  const failCard = seed => {
    const action = reviewActions.failCard();
    action.nextCardSeed = seed;
    return action;
  };

  const cardInHistory = (card, state) => {
    const { history } = state.review;
    return history.some(
      elem => elem.question === card.question && elem.answer === card.answer
    );
  };

  it('stores the updated review time of a passed card', async () => {
    let state = reducer(undefined, reviewActions.newReview(2, 3));

    const cards = getCards(0, 3, state.review.reviewTime);
    state = reducer(state, reviewActions.reviewLoaded(cards));

    const cardToUpdate = state.review.currentCard;
    const action = reviewActions.passCard();
    state = reducer(state, action);

    return expectSaga(updateProgressSaga, cardStore, action)
      .withState(state)
      .call([cardStore, 'putCard'], {
        _id: cardToUpdate._id,
        progress: {
          level: cardToUpdate.progress.level,
          reviewed: state.review.reviewTime,
        },
      })
      .run();
  });

  it('stores the updated progress of a failed card', async () => {
    let state = reducer(undefined, reviewActions.newReview(1, 3));

    const cards = getCards(0, 3, state.review.reviewTime);
    state = reducer(state, reviewActions.reviewLoaded(cards));

    const cardToUpdate = state.review.currentCard;
    const action = reviewActions.failCard();
    state = reducer(state, action);

    return expectSaga(updateProgressSaga, cardStore, action)
      .withState(state)
      .call([cardStore, 'putCard'], {
        _id: cardToUpdate._id,
        progress: { level: 0, reviewed: state.review.reviewTime },
      })
      .run();
  });

  it('stores the updated progress of a passed card when it is the last card', async () => {
    let state = reducer(undefined, reviewActions.newReview(2, 3));

    const cards = getCards(0, 1, state.review.reviewTime);
    state = reducer(state, reviewActions.reviewLoaded(cards));

    const cardToUpdate = state.review.currentCard;
    const action = reviewActions.passCard();
    state = reducer(state, action);
    expect(state.review.nextCard).toBe(null);
    expect(state.review.currentCard).toBe(null);
    expect(cardInHistory(cardToUpdate, state)).toBe(true);

    return expectSaga(updateProgressSaga, cardStore, action)
      .withState(state)
      .call([cardStore, 'putCard'], {
        _id: cardToUpdate._id,
        progress: {
          level: cardToUpdate.progress.level,
          reviewed: state.review.reviewTime,
        },
      })
      .run();
  });

  it('stores the updated progress of a failed card when it is the last card', async () => {
    let state = reducer(undefined, reviewActions.newReview(2, 3));

    const cards = getCards(0, 2, state.review.reviewTime);
    state = reducer(state, reviewActions.reviewLoaded(cards));

    // Pass the first card so it is in history
    state = reducer(state, reviewActions.passCard());

    // Now we should have a single card left that we want to fail.
    // We want to check we update it despite the fact that it won't go into
    // history yet.
    const cardToUpdate = state.review.currentCard;
    const action = reviewActions.failCard();
    state = reducer(state, action);
    expect(state.review.nextCard).toBe(null);
    expect(state.review.currentCard).toEqual(cardToUpdate);
    expect(cardInHistory(cardToUpdate, state)).toBe(false);

    return expectSaga(updateProgressSaga, cardStore, action)
      .withState(state)
      .call([cardStore, 'putCard'], {
        _id: cardToUpdate._id,
        progress: { level: 0, reviewed: state.review.reviewTime },
      })
      .run();
  });

  it('stores the updated review when the progress changes', async () => {
    let state = reducer(undefined, reviewActions.newReview(2, 3));

    const cards = getCards(1, 3, state.review.reviewTime);
    state = reducer(state, reviewLoaded(cards, 0, 0));

    state = reducer(state, passCard(0));
    state = reducer(state, passCard(0));

    const action = failCard(0);
    state = reducer(state, action);

    return expectSaga(updateProgressSaga, cardStore, action)
      .withState(state)
      .call([cardStore, 'putReview'], {
        maxCards: 3,
        maxNewCards: 2,
        completed: 2,
        newCardsCompleted: 1,
        history: [0, 1],
        failedCardsLevel1: [],
        failedCardsLevel2: [2],
      })
      .run();
  });

  it('deletes the review when the review is finished', async () => {
    let state = reducer(undefined, reviewActions.newReview(1, 1));

    const cards = getCards(1, 1, state.review.reviewTime);
    state = reducer(state, reviewLoaded(cards, 0, 0));

    const action = passCard(0);
    state = reducer(state, action);

    return expectSaga(updateProgressSaga, cardStore, action)
      .withState(state)
      .call([cardStore, 'deleteReview'])
      .run();
  });
});
