import Card from './card';
import classNames from 'classnames';
import { NATIVE_TOKEN_SYMBOLS } from '../constants';
import { nativeTokenFromPair } from '../helpers/asset_pairs';
import Chart from './chart';
import { VictoryArea } from 'victory';
import useMeasure from 'react-use-measure';
import { useState, useEffect } from 'react';
import { formatNumber, formatUSD } from '../helpers/number_formatters';
import { ApolloClient, gql, InMemoryCache } from '@apollo/client';
import { useRefreshingEffect } from '../helpers/effects';
import { timeString } from '../helpers/time_formatters';

// TODO: Update to actual graphql endpoint
const apolloClient = new ApolloClient({
  uri: 'https://graph.mirror.finance/graphql',
  cache: new InMemoryCache()
});

const PRICE_QUERY = gql`
  query PriceHistory($contractAddress: String!, $from: Float!, $to: Float!, $interval: Float!) {
    asset(token: $contractAddress) {
      prices {
        history(from: $from, to: $to, interval: $interval) {
          timestamp
          price
        }
      }
    }
  }
`;

function HistoricalPriceCard({ className, pair, saleTokenInfo, usdPrice, style }) {
  const nativeTokenAssetInfo = nativeTokenFromPair(pair.asset_infos);
  const nativeSymbol = NATIVE_TOKEN_SYMBOLS[nativeTokenAssetInfo.info.native_token.denom];
  const [chartWrapperRef, chartWrapperBounds] = useMeasure();
  const [chartSVGWidth, setChartSVGWidth] = useState();
  const [chartSVGHeight, setChartSVGHeight] = useState();
  const [data, setData] = useState();

  useRefreshingEffect(() => {
    const fetchData = async() => {
      const { data } = await apolloClient.query({
        fetchPolicy: 'no-cache',
        query: PRICE_QUERY,
        variables: {
          // TODO: Replace with actual contract address
          contractAddress: 'terra15gwkyepfc6xgca5t5zefzwy42uts8l2m4g40k6', // pair.contract_addr
          from: Date.now() - 60 * 60 * 1000,
          to: Date.now(),
          interval: 1 // Minute
        }
      });

      setData(data.asset.prices.history);
    }

    fetchData();
  }, 60_000, [pair]);

  // Match aspect ratio of container (which grows to fill the card)
  useEffect(() => {
    if(chartWrapperBounds.width > 0) {
      setChartSVGWidth(chartWrapperBounds.width);
    }

    if(chartWrapperBounds.height > 0) {
      setChartSVGHeight(chartWrapperBounds.height);
    }
  }, [chartWrapperBounds.width, chartWrapperBounds.height]);

  const areaDataStyle = {
    stroke: '#4E6EFF',
    strokeWidth: 3,
    fill: 'url(#fillGradient)'
  }

  return (
    <Card className={classNames('p-6 flex flex-col', className)} style={style}>
      <h2 className="text-lg font-bold">
        {nativeSymbol} / {saleTokenInfo.symbol}
      </h2>

      {
        usdPrice &&
        <h3 className="text-2xl font-bold my-5">
          {formatUSD(usdPrice)}
        </h3>
      }

      <svg className="h-0">
        <defs>
          <linearGradient id="fillGradient"
            x1="0%"
            x2="0%"
            y1="0%"
            y2="100%"
          >
            <stop offset="0%" stopColor="#4e6eff" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#86a7ff" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>

      <div ref={chartWrapperRef} className="flex-grow">
        {
          chartSVGWidth && chartSVGHeight && data &&
          <Chart
            width={chartSVGWidth}
            height={chartSVGHeight}
            padding={{ top: 30, left: 45, right: 0, bottom: 40 }}
            xAxis={{
              tickFormat: timeString,
              tickCount: 10
            }}
            yAxis={{
              tickFormat: formatNumber,
              tickCount: 10
            }}
          >
            <VictoryArea
              data={data}
              x="timestamp"
              y="price"
              style={{data: areaDataStyle}}
              interpolation={'natural'}
            />
          </Chart>
        }
      </div>
    </Card>
  );
}

export default HistoricalPriceCard;
