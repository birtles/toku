/* global afterEach, beforeEach, describe, expect, it */
/* eslint arrow-body-style: [ "off" ] */

import PouchDB from 'pouchdb';
import memdown from 'memdown';
import CardStore from './CardStore';

const waitForMs = ms =>
  new Promise(resolve => {
    setTimeout(resolve, ms);
  });

const waitForNumReviewChanges = (db, num) => {
  let resolver;
  const promise = new Promise(resolve => {
    resolver = resolve;
  });

  let recordedChanges = 0;
  db.changes({ since: 'now', live: true }).on('change', change => {
    if (!change.id.startsWith('review-')) {
      return;
    }
    if (++recordedChanges === num) {
      resolver();
    }
  });

  return promise;
};

const syncWithWaitableRemote = async (cardStore, remote) => {
  let pauseAction;
  await cardStore.setSyncServer(remote, {
    onIdle: () => {
      if (pauseAction) {
        pauseAction();
      }
    },
  });

  const waitForIdle = () => {
    return new Promise(resolve => {
      pauseAction = resolve;
    });
  };

  return waitForIdle;
};

describe('CardStore progress reporting', () => {
  let subject;
  let testRemote;

  const typicalReview = {
    maxCards: 3,
    maxNewCards: 2,
    completed: 1,
    newCardsCompleted: 0,
    history: ['abc', 'def'],
    failedCardsLevel1: ['def'],
    failedCardsLevel2: [],
  };

  beforeEach(() => {
    // Pre-fetching views seems to be a real bottle-neck when running tests
    subject = new CardStore({ pouch: { db: memdown }, prefetchViews: false });

    // A separate remote we use for reading back records directly, injecting
    // conflicting records etc.
    testRemote = new PouchDB('cards_remote', { db: memdown });
  });

  afterEach(() => Promise.all([subject.destroy(), testRemote.destroy()]));

  it('returns a newly-added review', async () => {
    await subject.putReview(typicalReview);
    const gotReview = await subject.getReview();
    expect(gotReview).toEqual(typicalReview);
  });

  it('updates the latest review', async () => {
    // Setup a remote so we can read back the review record
    await subject.setSyncServer(testRemote);

    // Set up a promise to track changes
    const changesPromise = waitForNumReviewChanges(testRemote, 2);

    // Put records twice
    await subject.putReview(typicalReview);
    // But wait a few milliseconds between to ensure they have different IDs
    await waitForMs(2);
    await subject.putReview({ ...typicalReview, completed: 2 });

    // Wait for the record(s) to sync
    await changesPromise;
    const reviews = await testRemote.allDocs({
      startkey: 'review-',
      endkey: 'review-\ufff0',
      include_docs: true,
    });

    // We should have updated the one record
    expect(reviews.rows).toHaveLength(1);
    expect(reviews.rows[0].value.rev).toEqual(expect.stringMatching(/^2-/));
    expect(reviews.rows[0].doc.completed).toBe(2);
  });

  it('returns the latest review', async () => {
    const waitForIdle = await syncWithWaitableRemote(subject, testRemote);

    // Push two new docs to the remote
    await testRemote.put({
      ...typicalReview,
      completed: 1,
      _id: 'review-1',
    });
    await testRemote.put({
      ...typicalReview,
      completed: 2,
      _id: 'review-2',
    });

    // Wait for sync to finish
    await waitForIdle();

    // Check the result of getReview
    const review = await subject.getReview();
    expect(review.completed).toBe(2);
  });

  it('allows deleting reviews', async () => {
    await subject.putReview(typicalReview);
    await subject.deleteReview();
    const gotReview = await subject.getReview();
    expect(gotReview).toBe(null);
  });

  it('deletes all reviews', async () => {
    const waitForIdle = await syncWithWaitableRemote(subject, testRemote);

    // Push two new docs to the remote
    await testRemote.put({
      ...typicalReview,
      completed: 1,
      _id: 'review-1',
    });
    await testRemote.put({
      ...typicalReview,
      completed: 2,
      _id: 'review-2',
    });

    // Wait for sync to finish then delete
    await waitForIdle();
    await subject.deleteReview();

    // Wait for sync to finish
    await waitForIdle();

    // Check there are no review docs in the remote
    const result = await testRemote.allDocs({
      startkey: 'review',
      endkey: 'review-\ufff0',
    });
    expect(result.rows).toHaveLength(0);
  });

  /*
  it('deletes older reviews when synchronizing', async () => {
    // -- push two new docs to the remote
    // -- wait for everything to sync back to the remote
    //    and check that the older doc got deleted
    //    (Again, wait for paused callback)
  });

  it('resolves conflicts by choosing the furthest review progress', async () => {
    // -- put a doc -- somehow work out what ID it got (use a separate remote?)
    // -- put a doc with an identical ID in a remote
    // -- connect the remote
    // -- wait for them to sync
    // -- check that the conflict is gone from the remote
  });

  it('reports changes to review doc', async() => {
  });

  it('doesn't report new review docs older than current', async() => {
  });
  */
});
