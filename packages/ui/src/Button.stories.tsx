import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import Button from './Button';

const meta: Meta<typeof Button> = {
  title: 'UI/Button',
  component: Button
};

export default meta;

type Story = StoryObj<typeof Button>;

export const Primary: Story = {
  args: { children: 'Primary Button', variant: 'primary' }
};

export const Secondary: Story = {
  args: { children: 'Secondary Button', variant: 'secondary' }
};

export const Ghost: Story = {
  args: { children: 'Ghost Button', variant: 'ghost' }
};
