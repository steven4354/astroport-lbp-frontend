import { render, screen, within } from '@testing-library/react';
import App from '../../components/app';
import { getLBPs, getTokenInfo } from '../../terra/queries';
import { Extension } from '@terra-money/terra.js';
import { mockSuccessfullyConnectedExtension } from '../test_helpers/terra-js_mocks';
import userEvent from "@testing-library/user-event";

jest.mock('@terra-money/terra.js');

jest.mock('../../terra/queries', () => ({
  __esModule: true,
  getLBPs: jest.fn(),
  getTokenInfo: jest.fn()
}));

// Simple stub for CurrentTokenSale component,
// which is unit tested separately.
jest.mock('../../components/current_token_sale', () =>
  () => (<div>Current Token Info</div>)
);

function buildLBP({
  start_time,
  end_time,
  native_token_denom,
  token_contract_addr,
  contract_addr = "terra123"
}) {
  return {
    contract_addr,
    start_time,
    end_time,
    asset_infos: [
      {
        info: {
          native_token: {
            denom: native_token_denom
          }
        }
      },
      {
        info: {
          token: {
            contract_addr: token_contract_addr
          }
        }
      }
    ]
  };
};

describe('App', () => {
  it('renders Scheduled and Previous Token Sales cards', async () => {
    const dateNowSpy = jest
      .spyOn(Date, 'now')
      .mockImplementation(() => new Date(2021, 5, 9).getTime());

    getLBPs.mockResolvedValue([
      buildLBP({
        start_time: (new Date(2021, 0, 1).getTime())/1000,
        end_time: (new Date(2021, 0, 4).getTime())/1000,
        native_token_denom: 'uust',
        token_contract_addr: 'terra1'
      }),
      buildLBP({
        start_time: (new Date(2021, 5, 10).getTime())/1000,
        end_time: (new Date(2021, 5, 14).getTime())/1000,
        native_token_denom: 'uust',
        token_contract_addr: 'terra2'
      }),
      buildLBP({
        start_time: (new Date(2021, 5, 8).getTime())/1000,
        end_time: (new Date(2021, 5, 10).getTime())/1000,
        native_token_denom: 'uust',
        token_contract_addr: 'terra3'
      })
    ]);

    getTokenInfo.mockImplementation(address => (
      {
        terra1: {
          name: 'Foo'
        },
        terra2: {
          name: 'Bar'
        },
        terra3: {
          name: 'Baz'
        }
      }[address]
    ));

    render(<App />);

    // Heading with sale token name
    expect(await screen.findByText('Baz Token Sale')).toBeInTheDocument();

    // Current token info component
    expect(await screen.findByText('Current Token Info')).toBeInTheDocument();

    // Tokens are in the correct cards with the correct time/dates
    const scheduledCard = (await screen.findByText('Scheduled Token Sales')).closest('div')
    const previousCard = (await screen.findByText('Previous Token Sales')).closest('div')

    const barCell = await within(scheduledCard).findByText('Bar');
    expect(barCell).toBeInTheDocument();
    expect(within(barCell.closest('tr')).queryByText('00:00 (UTC) 10-06-2021')).toBeInTheDocument();

    const fooCell = await within(previousCard).findByText('Foo')
    expect(fooCell).toBeInTheDocument();
    expect(within(fooCell.closest('tr')).queryByText('01-01-2021 - 04-01-2021')).toBeInTheDocument();

    // Tokens are not present in the wrong cards
    expect(within(scheduledCard).queryByText('Foo')).toBeNull();
    expect(within(scheduledCard).queryByText('Baz')).toBeNull();
    expect(within(previousCard).queryByText('Bar')).toBeNull();
    expect(within(previousCard).queryByText('Baz')).toBeNull();

    dateNowSpy.mockRestore();
  });

  it('displays partial wallet address after successful browser extension connection', async () => {
    mockSuccessfullyConnectedExtension(Extension, { address: 'terra1234567890' });

    getLBPs.mockResolvedValue([
      buildLBP({
        start_time: Date.now()/1000 - 60*60*24, // 1 day ago
        end_time: Date.now()/1000 + 60*60*24, // 1 day from now
        native_token_denom: 'uust',
        token_contract_addr: 'terra3'
      })
    ]);

    getTokenInfo.mockResolvedValue({
      name: 'Foo'
    });

    render(<App />);

    // Wait for data to load and Connect Wallet button to become visible
    await screen.findByText('Connect Wallet');

    // Wallet address should not yet be displayed
    expect(screen.queryByText('567890')).toBeNull();

    userEvent.click(screen.getByText('Connect Wallet'));

    expect(screen.getByText('terra1...567890')).toBeInTheDocument();
  });
});