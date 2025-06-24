import './App.css';
import { useState, useRef, useEffect } from 'react';
import * as d3 from 'd3';
import TextField from '@mui/material/TextField';
import Autocomplete from '@mui/material/Autocomplete';
import Button from '@mui/material/Button';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import Slider from '@mui/material/Slider';
import Box from '@mui/material/Box';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import { simulation } from './d3funcs'
//=============================================================================
function App() {

  const darkTheme = createTheme({
    palette: {
      mode: 'dark',
    },
  });

  const svgRef = useRef(null);
  const [fetchedData, setFetchedData] = useState(null);
  const [renderData, setRenderData] = useState(null);
  const [locations, setLocations] = useState(null);
  const [items, setItems] = useState(null);
  const [value, setValue] = useState(null);
  const [sliderValue, setSliderValue] = useState(80);
  const [rows, setRows] = useState([]);
  const urlref = useRef(null);
  const marks = [{ label: '2h', value: '0' }, { label: '4h', value: '20' }, { label: '6h', value: '40' }, { label: '8h', value: '60' }, { label: '10h', value: '80' }, { label: '12h', value: '100' }, { label: '1d', value: '120' }, { label: '2d', value: '140' }, { label: '3d', value: '160' }];
  const currentTime = Date.now();

  function createData(location, asset, connected) {
    return [{ location, asset, connected }];
  }

  //=============================================================================
  //fetching location list
  useEffect(() => {
    fetch('http://192.168.1.5:5000/site_list')
      .then((res) => {
        return res.json()
      })
      .then((data) => {
        setLocations(data)
      });
  }, [])

  //=============================================================================
  //inputting location list into autocomplete search
  useEffect(() => {
    let x = [];
    if (!locations) {
      return;
    }

    for (let i = 0; i + 1 <= locations.length; i++) {
      x.push({
        label: locations[i].name,
        key: i
      });
    }
    setItems(x);
  }, [locations])

  //=============================================================================
  //fetching data for graph when a location is selected
  useEffect(() => {
    if (!value) {
      return;
    }

    let url1 = 'http://192.168.1.5:5000/location?id=';
    let urlRefresh = 'http://192.168.1.5:5000/refresh?id=';

    for (let i = 0; i + 1 <= locations.length; i++) {
      if (value.label == locations[i].name) {
        urlref.current = locations[i].url;
      }
    }

    fetch(url1 + urlref.current)
      .then((res) => {
        return res.json();
      })
      .then((data) => {
        if (data.length == 0) {
          fetch(urlRefresh + urlref.current)
            .then((res) => {
              return res.json();
            })
            .then((data2) => {
              if (data2.length == 0) {
                fetch(url1 + urlref.current)
                  .then((res) => {
                    return res.json();
                  })
                  .then((data3) => {
                    setFetchedData(data3);
                  });
              }
            });
        }
        else {
          setFetchedData(data);
        }
      });
  }, [value])

  //=============================================================================
  //slider
  useEffect(() => {
    if (!fetchedData) {
      return;
    }
    const hour = 3600000;
    const nodes = fetchedData[0];
    const links = fetchedData[1];
    let tempLinks = [];
    if (sliderValue <= 100) {
      for (let i = 0; i + 1 <= 6; i++) {
        if (sliderValue == i * 20) {
          for (let j = 0; j + 1 <= links.length; j++) {
            if (currentTime - ((2 * (i + 1)) * hour) <= links[j].lastUpload) {
              tempLinks.push(links[j]);
            }
          }
          let x = [];
          x.push(nodes);
          x.push(tempLinks);
          setRenderData(x);
        }
      }
    }
    else {
      for (let i = 0; i + 1 <= 3; i++) {
        if (sliderValue == (i * 20) + 120) {
          for (let j = 0; j + 1 <= links.length; j++) {
            if (currentTime - ((24 * (i + 1)) * hour) <= links[j].lastUpload) {
              tempLinks.push(links[j]);
            }
          }
          let x = [];
          x.push(nodes);
          x.push(tempLinks);
          setRenderData(x);
        }
      }
    }

  }, [sliderValue, value, fetchedData])
  //=============================================================================
  //drawing graph
  useEffect(() => {
    if (!renderData) {
      return;
    }

    if (renderData.length == 0) {
      const text = document.createTextNode('no data');
      document.getElementById('main').appendChild(text);
    }

    const nodes = [...renderData[0]];
    const links = [...renderData[1]];

    let location = '';

    for (let i = 0; i + 1 <= nodes.length; i++) {
      if (nodes[i].type == 'rtu') {
        location = nodes[i].location;
      }
    }

    const width = window.innerWidth;
    const height = window.innerHeight;

    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height);

    svg.selectAll("*").remove();

    //=============================================
    //simulation
    const simulation = d3.forceSimulation(nodes)
      .force('charge', d3.forceManyBody().strength(-25))
      .force('x', d3.forceX(width / 2).strength(0.07))
      .force('y', d3.forceY(height / 2).strength(0.07))
      .force('collide', d3.forceCollide().radius(47))
      .force('link', d3.forceLink(links)
        .id(link => link.id)
        .distance(25)
        .strength(0.1))
      .on('tick', () => {
        nodeElements
          .attr('cx', node => node.x)
          .attr('cy', node => node.y);
        linkElements
          .attr('x1', link => link.source.x)
          .attr('y1', link => link.source.y)
          .attr('x2', link => link.target.x)
          .attr('y2', link => link.target.y);
        textElements
          .attr('x', node => node.x)
          .attr('y', node => node.y);
      });

    //=============================================
    //setting style
    function getNodeColor(node) {
      if (node.location != location) {
        return 'rgb(232, 94, 28)';
      }
      else if (node.type == 'rtu') {
        return 'rgb(25, 171, 255)';
      }
      else {
        return 'rgb(237, 153, 1)';
      }
    }

    function getLineStyle(link) {
      if (link.direct == true) {
        return '';
      }
      else {
        return '5 2';
      }
    }

    function getOutline(node) {
      let out = true;
      for (let i = 0; i + 1 <= links.length; i++) {
        if (node == links[i].source) {
          out = false;
        }
        else if (node == links[i].target) {
          out = false;
        }
      }

      if (out == true) {
        return 2;
      }
      else {
        return 0;
      }
    }

    //=============================================    
    //rendering
    const linkElements = svg.append('g')
      .selectAll('line')
      .data(links)
      .enter().append('line')
      .attr('stroke-width', 1.5)
      .attr('stroke', 'white')
      .attr('stroke-dasharray', getLineStyle);

    const graph = svg.selectAll('node')
      .data(nodes)
      .enter().append('g')
      .attr('class', function (d) { return 'node' + " " + d.id })
      .on('click', function (d) {

        function getLocationName(data) {
          for (let i = 0; i + 1 <= locations.length; i++) {
            if (data.currentTarget.__data__.location == locations[i].url) {
              return locations[i].name;
            }
          }
        }

        function getConnectedNodes(data) {
          let x = new Set();
          let empty = true;
          for (let i = 0; i + 1 <= links.length; i++) {
            if (data.currentTarget.__data__.id == links[i].source.id) {
              empty = false;
              x.add(links[i].target.id);
            }
            if (data.currentTarget.__data__.id == links[i].target.id) {
              empty = false;
              x.add(links[i].source.id);
            }
          }
          if (empty == true) {
            return '-';
          }
          else {
            let y = [...x];
            return y.map((d) => (d + ', '));
          }
        }

        setRows((createData(getLocationName(d), 'placeholder', getConnectedNodes(d))));

        function getConnectedNodesRadius(node) {
          let x = new Set();
          let big = false;
          if (node.id == d.currentTarget.__data__.id) {
            return 31;
          }
          else {
            for (let i = 0; i + 1 <= links.length; i++) {
              if (d.currentTarget.__data__.id == links[i].source.id) {
                x.add(links[i].target.id);
              }
              if (d.currentTarget.__data__.id == links[i].target.id) {
                x.add(links[i].source.id);
              }
            }
            let y = [...x];
            for (let i = 0; i + 1 <= y.length; i++) {
              if (node.id == y[i]) {
                big = true;
              }
            }
            if (big == true) {
              return 31;
            }
            else {
              return 20;
            }
          }
        }

        function getConnectedNodesFontSize(node) {
          let x = new Set();
          let big = false;
          if (node.id == d.currentTarget.__data__.id) {
            return 16;
          }
          else {
            for (let i = 0; i + 1 <= links.length; i++) {
              if (d.currentTarget.__data__.id == links[i].source.id) {
                x.add(links[i].target.id);
              }
              if (d.currentTarget.__data__.id == links[i].target.id) {
                x.add(links[i].source.id);
              }
            }
            let y = [...x];
            for (let i = 0; i + 1 <= y.length; i++) {
              if (node.id == y[i]) {
                big = true;
              }
            }
            if (big == true) {
              return '16';
            }
            else {
              return '12';
            }
          }
        }

        function getConnectedNodesOpacity(node) {
          let x = new Set();
          let big = false;
          if (node.id == d.currentTarget.__data__.id) {
            return 16;
          }
          else {
            for (let i = 0; i + 1 <= links.length; i++) {
              if (d.currentTarget.__data__.id == links[i].source.id) {
                x.add(links[i].target.id);
              }
              if (d.currentTarget.__data__.id == links[i].target.id) {
                x.add(links[i].source.id);
              }
            }
            let y = [...x];
            for (let i = 0; i + 1 <= y.length; i++) {
              if (node.id == y[i]) {
                big = true;
              }
            }
            if (big == true) {
              return '1';
            }
            else {
              return '0.1';
            }
          }
        }

        nodeElements.attr('r', getConnectedNodesRadius).attr('opacity', getConnectedNodesOpacity);
        textElements.attr('font-size', getConnectedNodesFontSize);
        linkElements.style('stroke-width', function (l) {
          if (l.source.id == d.currentTarget.__data__.id || l.target.id == d.currentTarget.__data__.id) {
            return 3;
          }
          else {
            return 1.5;
          }
        })

        linkElements.style('opacity', function (l) {
          if (l.source.id == d.currentTarget.__data__.id || l.target.id == d.currentTarget.__data__.id) {
            return 1;
          }
          else {
            return 0.1;
          }
        })
      })
      .on('mouseout', function (d) {
        nodeElements.attr('r', 26).attr('opacity', 1);
        textElements.attr('font-size', '15');
        linkElements.style('stroke-width', 1.5);
        linkElements.style('opacity', 1);
      });

    const nodeElements = graph.append('circle')
      .attr('r', 26)
      .attr('fill', getNodeColor)
      .attr('stroke', 'red')
      .attr('stroke-width', getOutline);

    const textElements = graph.append('text')
      .text(node => node.id)
      .attr('font-size', 15)
      .attr('fill', 'black')
      .attr('text-anchor', 'middle')
      .attr('dx', 0)
      .attr('dy', '.35em');

  }, [renderData])

  //=============================================================================
  //refresh button
  const handleClick = event => {
    let url1 = 'http://192.168.1.7:5000/location?id=';
    let urlRefresh = 'http://192.168.1.7:5000/location/refresh?id=';

    fetch(urlRefresh + urlref.current)
      .then((res) => {
        return res.json();
      })
      .then((data) => {
        fetch(url1 + urlref.current)
          .then((res) => {
            return res.json();
          })
          .then((data2) => {
            setFetchedData(data2);
          });
      });
  };

  //=============================================================================
  return (
    <div id='main' className='App' style={{ width: window.innerWidth, height: window.innerHeight }}>
      <div style={{ float: 'right' }}>
        <ThemeProvider theme={darkTheme}>
          <Table sx={{ minWidth: 450, maxwidth: 450 }}>
            <TableHead>
              <TableRow>
                <TableCell>Location Name</TableCell>
                <TableCell align='left'>Asset Name</TableCell>
                <TableCell align='left'>Connected Nodes</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => (
                <TableRow
                  key={row.name}
                  sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                >

                  <TableCell align='left'>{row.location}</TableCell>
                  <TableCell align='left'>{row.asset}</TableCell>
                  <TableCell align='left'>{row.connected}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ThemeProvider>
      </div>

      <div style={{ width: 480, height: 100 }}>
        <div style={{ width: 120, padding: 20, float: 'right' }}>
          <ThemeProvider theme={darkTheme}>
            <Box sx={{ width: 200, paddingBottom: 2, paddingLeft: 1 }}>
              <Slider
                size='small'
                valueLabelDisplay='off'
                defaultValue={80}
                track={false}
                step={20}
                min={0}
                max={160}
                marks={marks}
                onChange={(event, newValue) => {
                  setSliderValue(newValue);
                }}
                disabled={fetchedData == null ? true : false}
              />
            </Box>
            <Button
              onClick={handleClick}
              disabled={fetchedData == null ? true : false}
              variant='outlined'
              size='large'>
              refresh
            </Button>
          </ThemeProvider>
        </div>

        <div style={{ width: 300, padding: 20, paddingTop: 27 }}>
          <ThemeProvider theme={darkTheme}>
            <Autocomplete
              value={value}
              onChange={(event, newValue) => {
                setValue(newValue);
              }}
              disablePortal
              options={items}
              sx={{ width: 300 }}
              renderInput={(params) => <TextField {...params} label="location" />}
            />
          </ThemeProvider>
        </div>
      </div>
      <svg ref={svgRef}></svg>
    </div>
  )
};

export default App;
