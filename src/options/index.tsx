import styles from '@assets/styles/index.css?inline';

import createShadowRoot from '@/ui/createShadowRoot';

import Options from './Options';

const root = createShadowRoot(styles);

root.render(<Options />);
