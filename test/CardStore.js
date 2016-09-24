/* global afterEach, beforeEach, define, describe, it */
/* eslint arrow-body-style: [ "off" ] */

import memdown from 'memdown';
import { assert } from 'chai';
import CardStore from '../src/CardStore';
import { waitForEvents } from './testcommon';

describe('CardStore', () => {
  let subject;

  beforeEach('setup new store', () => {
    subject = new CardStore({ db: memdown });
  });

  afterEach('clean up store', () => subject.destroy());

  it('is initially empty', () => {
    return subject.getCards()
      .then(cards => {
        assert.strictEqual(cards.length, 0, 'Length of getCards() result');
      });
  });

  it('returns added cards', () => {
    return subject.putCard({ question: 'Question', answer: 'Answer' })
      .then(() => subject.getCards())
      .then(cards => {
        assert.strictEqual(cards.length, 1, 'Length of getCards() result');
        assert.strictEqual(cards[0].question, 'Question');
        assert.strictEqual(cards[0].answer, 'Answer');
      });
  });

  it('generates unique ascending IDs', () => {
    let prevId = '';
    for (let i = 0; i < 100; i++) {
      const id = CardStore.generateCardId();
      assert.isAbove(id, prevId);
      prevId = id;
    }
  });

  it('returns added cards in order', () => {
    let id1;
    let id2;

    return subject.putCard({ question: 'Q1', answer: 'A1' })
      .then(card => { id1 = card._id; })
      .then(() => subject.putCard({ question: 'Q2', answer: 'A2' }))
      .then(card => { id2 = card._id; })
      .then(() => subject.getCards())
      .then(cards => {
        // Sanity check
        assert.notStrictEqual(id1, id2, 'Card IDs are unique');

        assert.strictEqual(cards.length, 2, 'Expected no. of cards');
        assert.strictEqual(cards[0]._id, id2,
                           'Card added last is returned first');
        assert.strictEqual(cards[1]._id, id1,
                           'Card added first is returned last');
      });
  });

  // XXX Is this actually the behaviour we want? If we do this we won't be
  // able to distinguish between when we try to update a doc that has been
  // deleted and when we want to add a new doc with a specified ID.
  it('does not overwrite ID if provided', () => {
    return subject.putCard({ question: 'Question', answer: 'Answer',
                             _id: 'abc' })
      .then(card => {
        assert.strictEqual(card._id, 'abc',
                           'ID returned from putCard is the one specified');
      })
      .then(() => subject.getCards())
      .then(cards => {
        assert.strictEqual(cards[0]._id, 'abc',
                           'ID returned from getCards is the one specified');
      });
  });

  it('reports added cards', () => {
    let addedCard;
    let updateInfo;

    subject.onUpdate(info => { updateInfo = info; });

    return subject.putCard({ question: 'Q1', answer: 'A1' })
      .then(card => { addedCard = card; })
      // Wait for a few rounds of events so the update can take place
      .then(() => waitForEvents(3))
      .then(() => {
        assert.isOk(updateInfo, 'Change was recorded');
        assert.strictEqual(updateInfo.id, addedCard._id,
                           'Reported change has correct ID');
      });
  });

  it('does not return deleted cards', () => {
    return subject.putCard({ question: 'Question', answer: 'Answer' })
      .then(card => subject.deleteCard(card))
      .then(() => subject.getCards())
      .then(cards => {
        assert.strictEqual(cards.length, 0, 'Length of getCards() result');
      });
  });

  it('deletes the specified card', () => {
    let firstCard;
    return subject.putCard({ question: 'Question 1',
                             answer: 'Answer 1' })
      .then(card => { firstCard = card; })
      .then(() => subject.putCard({ question: 'Question 2',
                                    answer: 'Answer 2' }))
      .then(() => subject.deleteCard(firstCard))
      .then(() => subject.getCards())
      .then(cards => {
        assert.strictEqual(cards.length, 1, 'Length of getCards() result');
        assert.strictEqual(cards[0].question, 'Question 2');
        assert.strictEqual(cards[0].answer, 'Answer 2');
      });
  });

  it('reports an error when the card to be deleted cannot be found', () => {
    return subject.deleteCard({ _id: 'abc' })
      .then(() => {
        assert.fail('Should have reported an error for missing card');
      })
      .catch(err => {
        assert.strictEqual(err.status, 404);
        assert.strictEqual(err.name, 'not_found');
        assert.strictEqual(err.message, 'missing');
        assert.strictEqual(err.reason, 'deleted');
      });
  });

  it('reports deleted cards', () => {
    let addedCard;
    let updateInfo;

    subject.onUpdate(info => { updateInfo = info; });

    return subject.putCard({ question: 'Question', answer: 'Answer' })
      .then(card => { addedCard = card; })
      .then(() => subject.deleteCard(addedCard))
      .then(() => waitForEvents(5))
      .then(() => {
        assert.strictEqual(updateInfo.id, addedCard._id,
                           'Reported change has correct ID');
        assert.isOk(updateInfo.deleted,
                    'Reported change is a delete record');
      });
  });

  // XXX Test that we still delete, even when the revision is old
  // (probably requires we implement change handling first)

  it('updates the specified field of cards', () => {
    return subject.putCard({ question: 'Original question', answer: 'Answer' })
      .then(card => subject.putCard({ _id: card._id,
                                      _rev: card._rev,
                                      question: 'Updated question' }))
      .then(card => {
        assert.strictEqual(card.question, 'Updated question');
        assert.strictEqual(card.answer, 'Answer');
      })
      .then(() => subject.getCards())
      .then(cards => {
        assert.strictEqual(cards.length, 1, 'Length of getCards() result');
        assert.strictEqual(cards[0].question, 'Updated question');
        assert.strictEqual(cards[0].answer, 'Answer');
      });
  });

  it('updates cards even without a revision', () => {
    return subject.putCard({ question: 'Original question', answer: 'Answer' })
      .then(card => subject.putCard({ _id: card._id,
                                      question: 'Updated question' }))
      .then(card => {
        assert.strictEqual(card.question, 'Updated question');
        assert.strictEqual(card.answer, 'Answer');
      })
      .then(() => subject.getCards())
      .then(cards => {
        assert.strictEqual(cards.length, 1, 'Length of getCards() result');
        assert.strictEqual(cards[0].question, 'Updated question');
        assert.strictEqual(cards[0].answer, 'Answer');
      });
  });

  it('updates cards even when the revision is old', () => {
    let oldRevision;

    return subject.putCard({ question: 'Original question', answer: 'Answer' })
      .then(card => {
        oldRevision = card._rev;
        return subject.putCard({ _id: card._id,
                                 question: 'Updated question' }); })
      .then(card => subject.putCard({ _id: card._id,
                                      _rev: oldRevision,
                                      answer: 'Updated answer' }))
      .then(() => subject.getCards())
      .then(cards => {
        assert.strictEqual(cards.length, 1, 'Length of getCards() result');
        assert.strictEqual(cards[0].question, 'Updated question');
        assert.strictEqual(cards[0].answer, 'Updated answer');
      });
  });

  // XXX What should we do if the specified ID doesn't exist?? Need a test for
  // this

  it('reports changes to cards', () => {
    // XXX
  });
});
