import React from 'react';
import { browserHistory } from 'react-router';

import CardDB from '../cards';
import CardOverviewScreen from './CardOverviewScreen.jsx';
import Popup from './Popup.jsx';
import SettingsPanel from './SettingsPanel.jsx';
import Navbar from './Navbar.jsx';

export class App extends React.Component {
  static get propTypes() {
    return {
      nav: React.PropTypes.shape({
        screen: React.PropTypes.string,
        popup: React.PropTypes.string,
      }),
    };
  }

  render() {
    const overlayClass =
      `popup-overlay ${this.props.nav.popup ? 'active' : ''}`;
    const settingsActive = this.props.nav.popup === 'settings';
    const currentScreenLink = `/${this.props.nav.screen || ''}`;
    const closePopup = () => {
      browserHistory.replace(currentScreenLink);
    };

    return (
      <div>
        <Navbar settingsActive={settingsActive}
          currentScreenLink={currentScreenLink} />
        <main>
          <CardOverviewScreen db={CardDB} />
          <div className={overlayClass} />
          <Popup active={settingsActive} close={closePopup}>
            <SettingsPanel />
          </Popup>
        </main>
      </div>
    );
  }
}

export default App;
