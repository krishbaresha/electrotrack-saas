import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import CartTable from './CartTable';
import { useCartStore } from '../../store/cart.store';

// Cart total is the number a cashier hands to a customer — if this component
// silently shows the wrong total, the shop loses money on every sale.
describe('CartTable', () => {
  afterEach(() => {
    useCartStore.getState().clearCart();
  });

  it('shows an empty-cart placeholder when there are no items', () => {
    render(<CartTable />);
    expect(screen.getByText(/scan a serial number to add items/i)).toBeInTheDocument();
    expect(screen.queryByTestId('cart-total')).not.toBeInTheDocument();
  });

  it('sums item prices into the cart total', () => {
    useCartStore.getState().addItem({
      serialNumber: 'SN-001',
      productId: 'p1',
      productName: 'Test Phone',
      brand: 'TestBrand',
      sellingPrice: 15000,
    });
    useCartStore.getState().addItem({
      serialNumber: 'SN-002',
      productId: 'p1',
      productName: 'Test Phone',
      brand: 'TestBrand',
      sellingPrice: 10000,
    });

    render(<CartTable />);
    expect(screen.getByTestId('cart-total')).toHaveTextContent('₨ 25,000');
    expect(screen.getByText('2 items')).toBeInTheDocument();
  });

  it('removing an item updates the total', () => {
    useCartStore.getState().addItem({
      serialNumber: 'SN-001',
      productId: 'p1',
      productName: 'Test Phone',
      brand: 'TestBrand',
      sellingPrice: 15000,
    });

    render(<CartTable />);
    expect(screen.getByTestId('cart-total')).toHaveTextContent('₨ 15,000');

    useCartStore.getState().removeItem('SN-001');
    expect(useCartStore.getState().items).toHaveLength(0);
  });
});
