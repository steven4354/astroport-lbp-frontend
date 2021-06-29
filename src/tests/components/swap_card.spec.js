import { render, screen, act, within } from '@testing-library/react';
import SwapCard from '../../components/swap_card';
import userEvent from '@testing-library/user-event';
import { getSimulation, getReverseSimulation } from '../../terra/queries';

// Simulation is normally debounced
// This mocks the debounce function to just invoke the
// normally debounced function immediately
jest.mock('lodash/debounce', () => ({
  __esModule: true,
  default: fn => fn
}));

jest.mock('../../terra/queries', () => ({
  __esModule: true,
  getSimulation: jest.fn(),
  getReverseSimulation: jest.fn()
}));

describe('SwapCard', () => {
  const pair = {
    contract_addr: 'terra1',
    asset_infos: [
      {
        info: {
          native_token: {
            denom: 'uusd'
          }
        }
      },
      {
        info: {
          token: {
            contract_addr: 'terra2'
          }
        }
      }
    ]
  };

  const saleTokenInfo = {
    symbol: 'FOO',
    decimals: 5
  };

  const ustExchangeRate = 0.99;

  it('runs simulation and populates "to" field with simulated amount received', async () => {
    getSimulation.mockResolvedValue({
      return_amount: '210000000'
    });

    render(<SwapCard pair={pair} saleTokenInfo={saleTokenInfo} ustExchangeRate={ustExchangeRate} />);

    const fromInput = screen.getByLabelText('From');

    await act(async () => {
      // We need to delay between inputs otherwise we end up with a field value of "2"
      await userEvent.type(fromInput, '42', { delay: 1 });
    });

    // "From" value is correctly converted to USD
    const fromField = fromInput.closest('.border');
    expect(within(fromField).getByText('($41.58)')).toBeInTheDocument(); // 42 * 0.99

    // "To" value is properly set to value returned by simulation
    expect(screen.getByLabelText('To (estimated)')).toHaveDisplayValue('2100');

    // Since we've mocked out lodash's debounce function,
    // we'll run one simulation per keypress
    expect(getSimulation).toHaveBeenCalledWith(
      'terra1',
      4000000,
      {
        native_token: {
          denom: 'uusd'
        }
      }
    );

    expect(getSimulation).toHaveBeenCalledWith(
      'terra1',
      42000000,
      {
        native_token: {
          denom: 'uusd'
        }
      }
    );
  });

  it('runs reverse simulation and populates "from" field with simulated amount required', async () => {
    getReverseSimulation.mockResolvedValue({
      offer_amount: '42000000'
    });

    render(<SwapCard pair={pair} saleTokenInfo={saleTokenInfo} ustExchangeRate={ustExchangeRate} />);

    const toInput = screen.getByLabelText('To (estimated)');

    await act(async () => {
      await userEvent.type(toInput, '7');
    });

    // "From" value is properly set to value returned by reverse simulation
    expect(screen.getByLabelText('From')).toHaveDisplayValue('42');

    expect(getReverseSimulation).toHaveBeenCalledWith(
      'terra1',
      700000,
      {
        token: {
          contract_addr: 'terra2'
        }
      }
    );
  });

  it('runs new simulation when from asset is changed', async () => {
    getSimulation.mockImplementation((pairAddress, amount, offerAssetInfo) => {
      if(offerAssetInfo.native_token) {
        // Mocked response when offer asset is the native token
        return {
          return_amount: '210000000' // 5 decimals
        };
      } else {
        // Mocked response when offer asset is the sale token
        return {
          return_amount: '1000000' // 6 decimals
        }
      }
    });

    render(<SwapCard pair={pair} saleTokenInfo={saleTokenInfo} ustExchangeRate={ustExchangeRate} />);

    // First enter a from value (UST -> FOO)
    const fromInput = screen.getByLabelText('From');
    await act(async () => {
      await userEvent.type(fromInput, '7');
    });

    // Assert simulated value set
    expect(screen.getByLabelText('To (estimated)')).toHaveDisplayValue('2100');

    // Now change the from asset (FOO -> UST)
    const fromSelect = screen.getAllByLabelText('Asset')[0];
    await act(async () => {
      await userEvent.selectOptions(fromSelect, 'FOO');
    });

    // "To" value is properly set to value returned by simulation
    expect(screen.getByLabelText('To (estimated)')).toHaveDisplayValue('1');

    // First simulation when initial "from" amount was entered
    expect(getSimulation).toHaveBeenCalledWith(
      'terra1',
      7000000, // 6 decimals
      {
        native_token: {
          denom: 'uusd'
        }
      }
    );

    // Second simulation when "from" asset was changed
    expect(getSimulation).toHaveBeenCalledWith(
      'terra1',
      700000, // 5 decimals
      {
        token: {
          contract_addr: 'terra2'
        }
      }
    );
  });

  it('runs new reverse simulation when to asset is changed', async () => {
    getReverseSimulation.mockImplementation((pairAddress, amount, askAssetInfo) => {
      if(askAssetInfo.native_token) {
        // Mocked response when ask asset is the native token
        return {
          offer_amount: '1000' // 5 decimals
        };
      } else {
        // Mocked response when ask asset is the sale token
        return {
          offer_amount: '100000000' // 6 decimals
        }
      }
    });

    render(<SwapCard pair={pair} saleTokenInfo={saleTokenInfo} ustExchangeRate={ustExchangeRate} />);

    // First enter a to value (UST <- FOO)
    const fromInput = screen.getByLabelText('To (estimated)');
    await act(async () => {
      await userEvent.type(fromInput, '1');
    });

    // Assert simulated value set
    expect(screen.getByLabelText('From')).toHaveDisplayValue('100');

    // Now change the to asset (FOO <- UST)
    const fromSelect = screen.getAllByLabelText('Asset')[1];
    await act(async () => {
      await userEvent.selectOptions(fromSelect, 'UST');
    });

    // "From" value is properly set to value returned by reverse simulation
    expect(screen.getByLabelText('From')).toHaveDisplayValue('0.01');

    // First reverse simulation when initial "to" amount was entered
    expect(getReverseSimulation).toHaveBeenCalledWith(
      'terra1',
      100000, // 5 decimals
      {
        token: {
          contract_addr: 'terra2'
        }
      }
    );

    // Second reverse simulation when "to" asset was changed
    expect(getReverseSimulation).toHaveBeenCalledWith(
      'terra1',
      1000000, // 6 decimals
      {
        native_token: {
          denom: 'uusd'
        }
      }
    );
  });
});