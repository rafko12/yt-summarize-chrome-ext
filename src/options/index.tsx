import styles from '@assets/styles/index.css?inline';

import createIsolatedRoot from '@/ui/createIsolatedRoot';

import Options from './Options';

const root = createIsolatedRoot(styles);

root.render(<Options />);
