import React from 'react';
import { Preview } from '@storybook/react';
import '../src/tokens';

const preview: Preview = {
  parameters: {
    actions: { argTypesRegex: '^on[A-Z].*' },
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/ } }
  }
};

export default preview;
