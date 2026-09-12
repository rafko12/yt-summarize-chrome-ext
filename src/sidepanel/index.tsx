import styles from '@assets/styles/index.css?inline';

import createIsolatedRoot from '@/ui/createIsolatedRoot';

import { createSidePanelDependencies } from './dependencies';
import SidePanelApp from './SidePanelApp';

const root = createIsolatedRoot(styles);

root.render(<SidePanelApp dependencies={createSidePanelDependencies()} />);
