import { DataStore } from '../store/DataStore';
import { LRUMap } from '../utils/lru';
import { SuggestionResult } from './SuggestionResult';
import { findSubstringMatch, mergeAndTrimSuggestions } from './utils';
import { Card } from '../model';
import { toPlainText } from '../text/rich-text';
import { stripRuby } from '../text/ruby';
import { extractKeywordsFromCloze } from '../text/cloze';
import {
  isKana,
  isKanji,
  extractKanji,
  matchesCharacterClasses,
  CharacterClass,
} from '../text/japanese';

const MAX_RECENT_KEYWORDS = 6;
const MAX_SUGGESTIONS = 6;
const LOOKUP_CACHE_SIZE = 15;

interface KeywordSuggesterOptions {
  maxRecentKeywords?: number;
  maxSuggestions?: number;
}

export const enum RecentKeywordHandling {
  Omit,
  Include,
}

export class KeywordSuggester {
  store: DataStore;

  // Keywords that have been *entered* (i.e. added to cards) this session.
  recentKeywords: LRUMap<string, undefined>;

  // Cache of keywords we have looked up.
  lookupCache: LRUMap<string, string[]>;

  // The maximum number of initial suggestions to display based on keywords that
  // have already been added in this session.
  maxRecentKeywords: number;

  // The total maximum number of suggestions to return.
  maxSuggestions: number;

  constructor(store: DataStore, options?: KeywordSuggesterOptions) {
    this.store = store;

    this.maxRecentKeywords =
      options && typeof options.maxRecentKeywords !== 'undefined'
        ? options.maxRecentKeywords
        : MAX_RECENT_KEYWORDS;
    this.maxSuggestions = Math.max(
      options && typeof options.maxSuggestions !== 'undefined'
        ? options.maxSuggestions
        : MAX_SUGGESTIONS,
      this.maxRecentKeywords
    );

    this.recentKeywords = new LRUMap(this.maxRecentKeywords);
    this.lookupCache = new LRUMap(LOOKUP_CACHE_SIZE);

    // Whenever there is change to the cards or notes, our cached keyword
    // lookups might be wrong so drop them.
    this.store.changes.on('card', () => {
      this.lookupCache.clear();
    });
    this.store.changes.on('note', () => {
      this.lookupCache.clear();
    });
  }

  recordRecentKeyword(keyword: string) {
    this.recentKeywords.set(keyword.normalize(), undefined);
  }

  getSuggestions(
    input: string,
    defaultSuggestions: string[],
    recentKeywordHandling: RecentKeywordHandling
  ): SuggestionResult {
    const result: SuggestionResult = {};
    input = input.normalize();

    if (input === '') {
      const recentKeywords: string[] =
        recentKeywordHandling === RecentKeywordHandling.Include
          ? [...this.recentKeywords.keys()].reverse()
          : [];

      result.initialResult = mergeAndTrimSuggestions(
        defaultSuggestions,
        recentKeywords,
        this.maxSuggestions
      );
      return result;
    }

    // If we have a hit on the cache, return synchronously.
    const substringMatch = findSubstringMatch(
      input,
      this.lookupCache,
      this.maxSuggestions
    );
    if (substringMatch) {
      result.initialResult = substringMatch;
      return result;
    }

    result.asyncResult = new Promise<string[]>((resolve, reject) => {
      this.store.getKeywords(input, this.maxSuggestions).then(keywords => {
        this.lookupCache.set(input, keywords);
        resolve(keywords);
      });
    });

    return result;
  }

  static getSuggestionsFromCard(card: Partial<Card>): string[] {
    if (!card.front || !card.back) {
      return [];
    }

    const front = stripRuby(toPlainText(card.front)).normalize();
    const back = stripRuby(toPlainText(card.back)).normalize();

    // Look for a cloze -- if we find some stop there.
    const clozeKeywords = extractKeywordsFromCloze(front, back);
    if (clozeKeywords.length) {
      return clozeKeywords;
    }

    const result = [];
    const backFirstLine = back.split('\n')[0];

    // Japanese-specific check #1:
    //
    // If the front is kanji + kana and the first line of the back is kana it's
    // probably a card testing the kanji reading so use the front.
    if (
      matchesCharacterClasses(
        front,
        CharacterClass.Kanji | CharacterClass.Kana
      ) &&
      isKana(backFirstLine)
    ) {
      // We could try to extract the kanji parts of the back (e.g. so that if
      // we have 駐屯する we suggest only 駐屯) but sometimes we actually want
      // the kana parts (e.g. we want the trailing し in 眼差し).
      //
      // In future we should probably use a dictionary lookup to improve this.
      result.push(front);
      // If the first line of the back is a single, shortish word then treat
      // that as the back.
    } else if (backFirstLine.length < 20 && !/\s/.test(backFirstLine)) {
      result.push(backFirstLine);
    }

    // Japanese-specific check #2:
    //
    // By this point we will have at most one result. If it starts with kanji
    // then we might be studying kanji in the context of a word so we should
    // suggest each of the kanji characters as individual characters so we can
    // link to any cards we have on those particular characters.
    if (result.length === 1) {
      // Extract into an array so we test Unicode codepoints instead of UTF-16
      // code units.
      const chars = [...result[0]];
      // We don't want to add suggestions if the current suggestion is already
      // only one character or if it doesn't start with kanji.
      if (chars.length > 1 && isKanji(chars[0])) {
        result.push(...extractKanji(result[0]));
      }
    }

    return result;
  }
}
