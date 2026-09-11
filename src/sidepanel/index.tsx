import styles from '@assets/styles/index.css?inline';

import createIsolatedRoot from '@/ui/createIsolatedRoot';

import SidePanelApp from './SidePanelApp';

const root = createIsolatedRoot(styles);

root.render(<SidePanelApp />);
