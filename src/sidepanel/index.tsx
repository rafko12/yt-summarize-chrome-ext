import styles from '@assets/styles/index.css?inline';
import createShadowRoot from '@utils/createShadowRoot';

import SidePanelApp from './SidePanelApp';

const root = createShadowRoot(styles);

root.render(<SidePanelApp />);
