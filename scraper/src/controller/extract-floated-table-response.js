const { default: axios } = require("axios");
const fs = require("fs");
const cheerio = require("cheerio");

const BASEURL = "https://m.rbi.org.in//scripts/";
function parseRBICirculars(html) {
  const $ = cheerio.load(html);

  // Finding the table using the provided path
  const table = $("table.tablebg");

  // Check if table exists
  if (!table.length) {
    return { error: "Table not found at the specified path" };
  }

  // Get all rows from the table
  const rows = table.find("tr");

  // Extract table title from the first row
  const title = rows.first().text().trim();

  // Extract headers from the second row
  const headers = [];
  $(rows[1])
    .find("th")
    .each((i, el) => {
      headers.push($(el).text().trim());
    });

  // Extract data from the remaining rows
  const data = [];
  for (let i = 2; i < rows.length; i++) {
    const rowData = {};
    $(rows[i])
      .find("td")
      .each((j, el) => {
        // Clean up the text: replace <BR> with space and trim
        let value = $(el).text().replace(/\s+/g, " ").trim();

        // For the Circular Number column, extract the href attribute if it exists
        if (j === 0) {
          const link = $(el).find("a").attr("href");
          if (link) {
            rowData["link"] = BASEURL + link;
          }
        }

        rowData[headers[j]] = value;
      });
    data.push(rowData);
  }

  return {
    title,
    headers,
    circulars: data,
  };
}

const extract_page_data = async () => {
  try {
    const pageData = await axios.get(
      `https://m.rbi.org.in//scripts/BS_CircularIndexDisplay.aspx`
    );

    const data = pageData.data;
    const result = parseRBICirculars(data);

    // Convert result to JSON string before writing to file
    const jsonResult = JSON.stringify(result, null, 2);
    fs.writeFileSync("rbi_circulars.json", jsonResult);

    console.log(jsonResult);
    return result;
  } catch (error) {
    console.error("Error:", error.message);
  }
};

extract_page_data();
