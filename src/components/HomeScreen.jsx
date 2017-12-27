import React from 'react';
import PropTypes from 'prop-types';

import CardGrid from './CardGrid.jsx';
import Link from './Link.jsx';
import Navbar from './Navbar.jsx';
import SyncState from '../sync-states';

function HomeScreen(props) {
  let content;
  if (props.loading) {
    content = (
      <div className="summary-panel">
        <div className="icon -loading" />
      </div>
    );
  } else if (props.hasCards) {
    content = <CardGrid />;
  } else {
    content = (
      <div className="summary-panel">
        <div className="icon -nocards" />
        <h4 className="heading">You don&rsquo;t have any cards yet</h4>
        <div className="details">
          <Link
            className="button -primary -center -icon -addcard"
            href="/cards/new">
            Add a card
          </Link>
          {props.syncState === SyncState.NOT_CONFIGURED ? (
            <React.Fragment>
              <p>Or download cards you created elsewhere</p>
              <Link
                className="button -center -icon -settings"
                href="/settings#sync">
                Configure sync server
              </Link>
            </React.Fragment>
          ) : (
            ''
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="home-screen">
      <Navbar syncState={props.syncState} />
      <section className="content-screen" tabIndex="-1">
        {content}
      </section>
    </div>
  );
}

HomeScreen.propTypes = {
  loading: PropTypes.bool.isRequired,
  hasCards: PropTypes.bool.isRequired,
  syncState: PropTypes.symbol.isRequired,
};

export default HomeScreen;
