/**
 * Base class
 * @global
 * @class
 * @name ApiInterface
 */
var ApiInterface = function() {};
var Api = new ApiInterface();


/**
 * This element specifies the information which shall be used to establish a mapping to an XML element stored within a Custom XML.
 * @typedef {Object} XmlMapping
 * @property {string} prefixMapping The set of prefix mappings which shall be used to interpret the XPath expression specified in xpath.
 * @property {string} xpath The XPath expression.
 * @property {string} storeItemID The custom XML data identifier.
 * @example
 * {
 *   "prefixMapping": "xmlns:ns0='http://example.com/example'",
 *   "xpath": "//ns0:book",
 *   "storeItemID": "testXmlPart"
 * }
 */

/**
 * Class representing a bookmark in the document.
 * @constructor
 */
function ApiBookmark(startMark, endMark){}

/**
 * Class representing a container for paragraphs and tables.
 * @param Document
 * @constructor
 */
function ApiDocumentContent(Document){}

/**
 * Class representing the paragraph properties.
 * @constructor
 */
function ApiParaPr(Parent, ParaPr){}

/**
 * Class representing a paragraph bullet.
 * @constructor
 */
function ApiBullet(Bullet){}

/**
 * Class representing a paragraph.
 * @constructor
 * @extends {ApiParaPr}
 */
function ApiParagraph(Paragraph){}
ApiParagraph.prototype = Object.create(ApiParaPr.prototype);
ApiParagraph.prototype.constructor = ApiParagraph;

/**
 * Class representing the table properties.
 * @constructor
 */
function ApiTablePr(Parent, TablePr){}

/**
 * Class representing the text properties.
 * @constructor
 */
function ApiTextPr(Parent, TextPr){}

/**
 * Class representing a small text block called 'run'.
 * @constructor
 * @extends {ApiTextPr}
 */
function ApiRun(Run){}
ApiRun.prototype = Object.create(ApiTextPr.prototype);
ApiRun.prototype.constructor = ApiRun;

/**
 * Class representing a Paragraph hyperlink.
 * @constructor
 */
function ApiHyperlink(ParaHyperlink){}
ApiHyperlink.prototype.constructor = ApiHyperlink;

/**
 * Returns a type of the ApiHyperlink class.
 * @memberof ApiHyperlink
 * @returns {"hyperlink"}
 */
ApiHyperlink.prototype.GetClassType = function(){ return ""; };

/**
 * Sets the hyperlink address.
 * @param {string} sLink - The hyperlink address.
 * @returns {boolean}
 */
ApiHyperlink.prototype.SetLink = function(sLink){ return true; };

/**
 * Sets the hyperlink display text.
 * @param {string} sDisplay - The text to display the hyperlink.
 * @returns {boolean}
 */
ApiHyperlink.prototype.SetDisplayedText = function(sDisplay){ return true; };

/**
 * Sets the screen tip text of the hyperlink.
 * @param {string} sScreenTipText - The screen tip text of the hyperlink.
 * @returns {boolean}
 */
ApiHyperlink.prototype.SetScreenTipText = function(sScreenTipText){ return true; };

/**
 * Returns the hyperlink address.
 * @returns {string} 
 */
ApiHyperlink.prototype.GetLinkedText = function(){ return ""; };

/**
 * Returns the hyperlink display text.
 * @returns {string} 
 */
ApiHyperlink.prototype.GetDisplayedText = function(){ return ""; };

/**
 * Returns the screen tip text of the hyperlink.
 * @returns {string} 
 */
ApiHyperlink.prototype.GetScreenTipText = function(){ return ""; };

/**
 * Returns the hyperlink element using the position specified.
 * @param {number} nPos - The position where the element which content we want to get must be located.
 * @returns {ParagraphContent}
 */
ApiHyperlink.prototype.GetElement = function(nPos){ return new ParagraphContent(); };

/**
 * Returns a number of elements in the current hyperlink.
 * @returns {number}
 */
ApiHyperlink.prototype.GetElementsCount = function(){ return 0; };

/**
 * Sets the default hyperlink style.
 * @returns {boolean}
 */
ApiHyperlink.prototype.SetDefaultStyle = function(){ return true; };

/**
 * Class representing a style.
 * @constructor
 */
function ApiStyle(Style){}

/**
 * Class representing a document section.
 * @constructor
 */
function ApiSection(Section){}

/**
 * Class representing the table row properties.
 * @constructor
 */
function ApiTableRowPr(Parent, RowPr){}

/**
 * Class representing the table cell properties.
 * @constructor
 */
function ApiTableCellPr(Parent, CellPr){}

/**
 * Class representing the numbering properties.
 * @constructor
 */
function ApiNumbering(Num){}

/**
 * Class representing a reference to a specified level of the numbering.
 * @constructor
 */
function ApiNumberingLevel(Num, Lvl){}

/**
 * Class representing a set of formatting properties which shall be conditionally applied to the parts of a table
 * which match the requirement specified on the <code>Type</code>.
 * @constructor
 */
function ApiTableStylePr(Type, Parent, TableStylePr){}

/**
 * Class representing an unsupported element.
 * @constructor
 */
function ApiUnsupported(){}

/**
 * Class representing a chart.
 * @constructor
 *
 */
function ApiChart(Chart){}
ApiChart.prototype = Object.create(ApiDrawing.prototype);
ApiChart.prototype.constructor = ApiChart;

/**
 * Class representing shape geometry
 * @constructor
 */
function ApiGeometry(geometry) {}

/**
 * Class representing a path command
 * @constructor
 */
function ApiPathCommand(command) {}

/**
 * Class representing a path in geometry
 * @constructor
 */
function ApiPath(path) {}

/**
 * Class representing a chart series.
 * @constructor
 *
 */
function ApiChartSeries(oChartSpace, nIdx){}

/**
 * Class representing a base class for color types.
 * @constructor
 */
function ApiUniColor(Unicolor){}

/**
 * Class representing an RGB Color.
 * @constructor
 */
function ApiRGBColor(r, g, b){}
ApiRGBColor.prototype = Object.create(ApiUniColor.prototype);
ApiRGBColor.prototype.constructor = ApiRGBColor;

/**
 * Class representing a Scheme Color.
 * @constructor
 */
function ApiSchemeColor(sColorId){}
ApiSchemeColor.prototype = Object.create(ApiUniColor.prototype);
ApiSchemeColor.prototype.constructor = ApiSchemeColor;

/**
 * Class representing a Preset Color.
 * @constructor
 */
function ApiPresetColor(sPresetColor){}
ApiPresetColor.prototype = Object.create(ApiUniColor.prototype);
ApiPresetColor.prototype.constructor = ApiPresetColor;

/**
 * Class representing a base class for fill.
 * @constructor
 */
function ApiFill(UniFill){}

/**
 * Class representing a stroke.
 * @constructor
 */
function ApiStroke(oLn){}

/**
 * Class representing gradient stop.
 * @constructor
 */
function ApiGradientStop(oApiUniColor, pos){}

/**
 * Class representing a container for the paragraph elements.
 * @constructor
 */
function ApiInlineLvlSdt(Sdt){}

/**
 * Class representing a list of values of the combo box / drop-down list content control.
 * @constructor
 */
function ApiContentControlList(Parent){}

/**
 * Class representing an entry of the combo box / drop-down list content control.
 * @constructor
 */
function ApiContentControlListEntry(Sdt, Parent, Text, Value){}

/**
 * Class representing a container for the document content.
 * @constructor
 */
function ApiBlockLvlSdt(Sdt){}

/**
 * Class representing the settings which are used to create a watermark.
 * @constructor
 */
function ApiWatermarkSettings(oSettings){}

/**
 * Class representing document properties (similar to BuiltInDocumentProperties in VBA).
 * @constructor
 */
function ApiCore(oCore) {}

/**
 * Class representing custom properties of the document.
 * @constructor
 */
function ApiCustomProperties(oCustomProperties) {}

/**
 * Twentieths of a point (equivalent to 1/1440th of an inch).
 * @typedef {number} twips
 */

/**
 * Any valid element which can be added to the document structure.
 * @typedef {(ApiParagraph | ApiTable | ApiBlockLvlSdt)} DocumentElement
 */

/**
 * The style type used for the document element.
 * @typedef {("paragraph" | "table" | "run" | "numbering")} StyleType
 */

/**
 * 240ths of a line.
 * @typedef {number} line240
 */

/**
 * Half-points (2 half-points = 1 point).
 * @typedef {number} hps
 */

/**
 * A numeric value from 0 to 255.
 * @typedef {number} byte
 */

/**
 * 60000th of a degree (5400000 = 90 degrees).
 * @typedef {number} PositiveFixedAngle
 */

/**
 * A border type which will be added to the document element.
 * <b>"none"</b> - no border will be added to the created element or the selected element side.
 * <b>"single"</b> - a single border will be added to the created element or the selected element side.
 * @typedef {("none" | "single")} BorderType
 */

/**
 * A shade type which can be added to the document element.
 * @typedef {("nil" | "clear")} ShdType
 */

/**
 * Custom tab types.
 * @typedef {("clear" | "left" | "right" | "center")} TabJc
 */

/**
 * Eighths of a point (24 eighths of a point = 3 points).
 * @typedef {number} pt_8
 */

/**
 * A point.
 * @typedef {number} pt
 */

/**
 * Header and footer types which can be applied to the document sections.
 * <b>"default"</b> - a header or footer which can be applied to any default page.
 * <b>"title"</b> - a header or footer which is applied to the title page.
 * <b>"even"</b> - a header or footer which can be applied to even pages to distinguish them from the odd ones (which will be considered default).
 * @typedef {("default" | "title" | "even")} HdrFtrType
 */

/**
 * The possible values for the units of the width property are defined by a specific table or table cell width property.
 * <b>"auto"</b> - sets the table or table cell width to auto width.
 * <b>"twips"</b> - sets the table or table cell width to be measured in twentieths of a point.
 * <b>"nul"</b> - sets the table or table cell width to be of a zero value.
 * <b>"percent"</b> - sets the table or table cell width to be measured in percent to the parent container.
 * @typedef {("auto" | "twips" | "nul" | "percent")} TableWidth
 */

/**
 * This simple type specifies possible values for the table sections to which the current conditional formatting properties will be applied when this selected table style is used.
 * <b>"topLeftCell"</b> - specifies that the table formatting is applied to the top left cell.
 * <b>"topRightCell"</b> - specifies that the table formatting is applied to the top right cell.
 * <b>"bottomLeftCell"</b> - specifies that the table formatting is applied to the bottom left cell.
 * <b>"bottomRightCell"</b> - specifies that the table formatting is applied to the bottom right cell.
 * <b>"firstRow"</b> - specifies that the table formatting is applied to the first row.
 * <b>"lastRow"</b> - specifies that the table formatting is applied to the last row.
 * <b>"firstColumn"</b> - specifies that the table formatting is applied to the first column. Any subsequent row which is in *table header* ({@link ApiTableRowPr#SetTableHeader}) will also use this conditional format.
 * <b>"lastColumn"</b> - specifies that the table formatting is applied to the last column.
 * <b>"bandedColumn"</b> - specifies that the table formatting is applied to odd numbered groupings of rows.
 * <b>"bandedColumnEven"</b> - specifies that the table formatting is applied to even numbered groupings of rows.
 * <b>"bandedRow"</b> - specifies that the table formatting is applied to odd numbered groupings of columns.
 * <b>"bandedRowEven"</b> - specifies that the table formatting is applied to even numbered groupings of columns.
 * <b>"wholeTable"</b> - specifies that the conditional formatting is applied to the whole table.
 * @typedef {("topLeftCell" | "topRightCell" | "bottomLeftCell" | "bottomRightCell" | "firstRow" | "lastRow" |
 *     "firstColumn" | "lastColumn" | "bandedColumn" | "bandedColumnEven" | "bandedRow" | "bandedRowEven" |
 *     "wholeTable")} TableStyleOverrideType
 */

/**
 * The types of elements that can be added to the paragraph structure.
 * @typedef {(ApiUnsupported | ApiRun | ApiInlineLvlSdt | ApiHyperlink | ApiFormBase)} ParagraphContent
 */

/**
 * The types of elements that can be added to the paragraph structure.
 * @typedef {("ltr" | "rtl")} ReadingOrder
 */

/**
 * The possible values for the base which the relative horizontal positioning of an object will be calculated from.
 * @typedef {("character" | "column" | "leftMargin" | "rightMargin" | "margin" | "page")} RelFromH
 */

/**
 * The possible values for the base which the relative vertical positioning of an object will be calculated from.
 * @typedef {("bottomMargin" | "topMargin" | "margin" | "page" | "line" | "paragraph")} RelFromV
 */

/**
 * English measure unit. 1 mm = 36000 EMUs, 1 inch = 914400 EMUs.
 * @typedef {number} EMU
 */

/**
 * This type specifies the preset shape geometry that will be used for a shape.
 * @typedef {("accentBorderCallout1" | "accentBorderCallout2" | "accentBorderCallout3" | "accentCallout1" |
 *     "accentCallout2" | "accentCallout3" | "actionButtonBackPrevious" | "actionButtonBeginning" |
 *     "actionButtonBlank" | "actionButtonDocument" | "actionButtonEnd" | "actionButtonForwardNext" |
 *     "actionButtonHelp" | "actionButtonHome" | "actionButtonInformation" | "actionButtonMovie" |
 *     "actionButtonReturn" | "actionButtonSound" | "arc" | "bentArrow" | "bentConnector2" | "bentConnector3" |
 *     "bentConnector4" | "bentConnector5" | "bentUpArrow" | "bevel" | "blockArc" | "borderCallout1" |
 *     "borderCallout2" | "borderCallout3" | "bracePair" | "bracketPair" | "callout1" | "callout2" | "callout3" |
 *     "can" | "chartPlus" | "chartStar" | "chartX" | "chevron" | "chord" | "circularArrow" | "cloud" |
 *     "cloudCallout" | "corner" | "cornerTabs" | "cube" | "curvedConnector2" | "curvedConnector3" |
 *     "curvedConnector4" | "curvedConnector5" | "curvedDownArrow" | "curvedLeftArrow" | "curvedRightArrow" |
 *     "curvedUpArrow" | "decagon" | "diagStripe" | "diamond" | "dodecagon" | "donut" | "doubleWave" | "downArrow" | "downArrowCallout" | "ellipse" | "ellipseRibbon" | "ellipseRibbon2" | "flowChartAlternateProcess" | "flowChartCollate" | "flowChartConnector" | "flowChartDecision" | "flowChartDelay" | "flowChartDisplay" | "flowChartDocument" | "flowChartExtract" | "flowChartInputOutput" | "flowChartInternalStorage" | "flowChartMagneticDisk" | "flowChartMagneticDrum" | "flowChartMagneticTape" | "flowChartManualInput" | "flowChartManualOperation" | "flowChartMerge" | "flowChartMultidocument" | "flowChartOfflineStorage" | "flowChartOffpageConnector" | "flowChartOnlineStorage" | "flowChartOr" | "flowChartPredefinedProcess" | "flowChartPreparation" | "flowChartProcess" | "flowChartPunchedCard" | "flowChartPunchedTape" | "flowChartSort" | "flowChartSummingJunction" | "flowChartTerminator" | "foldedCorner" | "frame" | "funnel" | "gear6" | "gear9" | "halfFrame" | "heart" | "heptagon" | "hexagon" | "homePlate" | "horizontalScroll" | "irregularSeal1" | "irregularSeal2" | "leftArrow" | "leftArrowCallout" | "leftBrace" | "leftBracket" | "leftCircularArrow" | "leftRightArrow" | "leftRightArrowCallout" | "leftRightCircularArrow" | "leftRightRibbon" | "leftRightUpArrow" | "leftUpArrow" | "lightningBolt" | "line" | "lineInv" | "mathDivide" | "mathEqual" | "mathMinus" | "mathMultiply" | "mathNotEqual" | "mathPlus" | "moon" | "nonIsoscelesTrapezoid" | "noSmoking" | "notchedRightArrow" | "octagon" | "parallelogram" | "pentagon" | "pie" | "pieWedge" | "plaque" | "plaqueTabs" | "plus" | "quadArrow" | "quadArrowCallout" | "rect" | "ribbon" | "ribbon2" | "rightArrow" | "rightArrowCallout" | "rightBrace" | "rightBracket" | "round1Rect" | "round2DiagRect" | "round2SameRect" | "roundRect" | "rtTriangle" | "smileyFace" | "snip1Rect" | "snip2DiagRect" | "snip2SameRect" | "snipRoundRect" | "squareTabs" | "star10" | "star12" | "star16" | "star24" | "star32" | "star4" | "star5" | "star6" | "star7" | "star8" | "straightConnector1" | "stripedRightArrow" | "sun" | "swooshArrow" | "teardrop" | "trapezoid" | "triangle" | "upArrowCallout" | "upDownArrow" | "upDownArrow" | "upDownArrowCallout" | "uturnArrow" | "verticalScroll" | "wave" | "wedgeEllipseCallout" | "wedgeRectCallout" | "wedgeRoundRectCallout")} ShapeType
 */

/**
 * This type specifies the formula type that will be used for a geometry guide.
 * @typedef {("*\/" | "+-" | "+\/" | "?:" | "abs" | "at2" | "cat2" | "cos" | "max" | "min" | "mod" | "pin" | "sat2" | "sin" | "sqrt" | "tan" | "val")} GeometryFormulaType
 */

/**
 * This type specifies the available chart types which can be used to create a new chart.
 * @typedef {(
 *     "bar" | "barStacked" | "barStackedPercent" | "bar3D" | "barStacked3D" | "barStackedPercent3D" | "barStackedPercent3DPerspective" |
 *     "horizontalBar" | "horizontalBarStacked" | "horizontalBarStackedPercent" | "horizontalBar3D" | "horizontalBarStacked3D" | "horizontalBarStackedPercent3D" |
 *     "lineNormal" | "lineStacked" | "lineStackedPercent" | "lineNormalMarker" | "lineStackedMarker" | "lineStackedPerMarker" | "line3D" |
 *     "pie" | "pie3D" | "doughnut" |
 *     "scatter" | "scatterLine" | "scatterLineMarker" | "scatterSmooth" | "scatterSmoothMarker" |
 *     "stock" |
 *     "area" | "areaStacked" | "areaStackedPercent" |
 *     "comboCustom" | "comboBarLine" | "comboBarLineSecondary" |
 *     "radar" | "radarMarker" | "radarFilled" |
 *     "unknown"
 * )} ChartType
 */

/**
 * This type specifies the type of drawing lock.
 * @typedef {("noGrp" | "noUngrp" | "noSelect" | "noRot" | "noChangeAspect" | "noMove" | "noResize" | "noEditPoints" | "noAdjustHandles"
 * | "noChangeArrowheads" | "noChangeShapeType" | "noDrilldown" | "noTextEdit" | "noCrop" | "txBox")} DrawingLockType
 */

/**
 * Fill type for paths
 * @typedef {("none" | "norm" | "lighten" | "lightenLess" | "darken" | "darkenLess")} PathFillType
 */

/**
 * Path command types
 * @typedef {("moveTo" | "lineTo" | "bezier3" | "bezier4" | "arcTo" | "close")} PathCommandType
 */

/**
 * The available text vertical alignment (used to align text in a shape with a placement for text inside it).
 * @typedef {("top" | "center" | "bottom")} VerticalTextAlign
 */

/**
 * The available color scheme identifiers.
 * @typedef {("accent1" | "accent2" | "accent3" | "accent4" | "accent5" | "accent6" | "bg1" | "bg2" | "dk1" | "dk2"
 *     | "lt1" | "lt2" | "tx1" | "tx2")} SchemeColorId
 */

/**
 * The available preset color names.
 * @typedef {("aliceBlue" | "antiqueWhite" | "aqua" | "aquamarine" | "azure" | "beige" | "bisque" | "black" |
 *     "blanchedAlmond" | "blue" | "blueViolet" | "brown" | "burlyWood" | "cadetBlue" | "chartreuse" | "chocolate"
 *     | "coral" | "cornflowerBlue" | "cornsilk" | "crimson" | "cyan" | "darkBlue" | "darkCyan" | "darkGoldenrod" |
 *     "darkGray" | "darkGreen" | "darkGrey" | "darkKhaki" | "darkMagenta" | "darkOliveGreen" | "darkOrange" |
 *     "darkOrchid" | "darkRed" | "darkSalmon" | "darkSeaGreen" | "darkSlateBlue" | "darkSlateGray" |
 *     "darkSlateGrey" | "darkTurquoise" | "darkViolet" | "deepPink" | "deepSkyBlue" | "dimGray" | "dimGrey" |
 *     "dkBlue" | "dkCyan" | "dkGoldenrod" | "dkGray" | "dkGreen" | "dkGrey" | "dkKhaki" | "dkMagenta" |
 *     "dkOliveGreen" | "dkOrange" | "dkOrchid" | "dkRed" | "dkSalmon" | "dkSeaGreen" | "dkSlateBlue" |
 *     "dkSlateGray" | "dkSlateGrey" | "dkTurquoise" | "dkViolet" | "dodgerBlue" | "firebrick" | "floralWhite" |
 *     "forestGreen" | "fuchsia" | "gainsboro" | "ghostWhite" | "gold" | "goldenrod" | "gray" | "green" |
 *     "greenYellow" | "grey" | "honeydew" | "hotPink" | "indianRed" | "indigo" | "ivory" | "khaki" | "lavender" | "lavenderBlush" | "lawnGreen" | "lemonChiffon" | "lightBlue" | "lightCoral" | "lightCyan" | "lightGoldenrodYellow" | "lightGray" | "lightGreen" | "lightGrey" | "lightPink" | "lightSalmon" | "lightSeaGreen" | "lightSkyBlue" | "lightSlateGray" | "lightSlateGrey" | "lightSteelBlue" | "lightYellow" | "lime" | "limeGreen" | "linen" | "ltBlue" | "ltCoral" | "ltCyan" | "ltGoldenrodYellow" | "ltGray" | "ltGreen" | "ltGrey" | "ltPink" | "ltSalmon" | "ltSeaGreen" | "ltSkyBlue" | "ltSlateGray" | "ltSlateGrey" | "ltSteelBlue" | "ltYellow" | "magenta" | "maroon" | "medAquamarine" | "medBlue" | "mediumAquamarine" | "mediumBlue" | "mediumOrchid" | "mediumPurple" | "mediumSeaGreen" | "mediumSlateBlue" | "mediumSpringGreen" | "mediumTurquoise" | "mediumVioletRed" | "medOrchid" | "medPurple" | "medSeaGreen" | "medSlateBlue" | "medSpringGreen" | "medTurquoise" | "medVioletRed" | "midnightBlue" | "mintCream" | "mistyRose" | "moccasin" | "navajoWhite" | "navy" | "oldLace" | "olive" | "oliveDrab" | "orange" | "orangeRed" | "orchid" | "paleGoldenrod" | "paleGreen" | "paleTurquoise" | "paleVioletRed" | "papayaWhip" | "peachPuff" | "peru" | "pink" | "plum" | "powderBlue" | "purple" | "red" | "rosyBrown" | "royalBlue" | "saddleBrown" | "salmon" | "sandyBrown" | "seaGreen" | "seaShell" | "sienna" | "silver" | "skyBlue" | "slateBlue" | "slateGray" | "slateGrey" | "snow" | "springGreen" | "steelBlue" | "tan" | "teal" | "thistle" | "tomato" | "turquoise" | "violet" | "wheat" | "white" | "whiteSmoke" | "yellow" | "yellowGreen")} PresetColor
 */

/**
 * Possible values for the position of chart tick labels (either horizontal or vertical).
 * <b>"none"</b> - not display the selected tick labels.
 * <b>"nextTo"</b> - sets the position of the selected tick labels next to the main label.
 * <b>"low"</b> - sets the position of the selected tick labels in the part of the chart with lower values.
 * <b>"high"</b> - sets the position of the selected tick labels in the part of the chart with higher values.
 * @typedef {("none" | "nextTo" | "low" | "high")} TickLabelPosition
 */

/**
 * The type of a fill which uses an image as a background.
 * <b>"tile"</b> - if the image is smaller than the shape which is filled, the image will be tiled all over the created shape surface.
 * <b>"stretch"</b> - if the image is smaller than the shape which is filled, the image will be stretched to fit the created shape surface.
 * @typedef {"tile" | "stretch"} BlipFillType
 */

/**
 * The available preset patterns which can be used for the fill.
 * @typedef {"cross" | "dashDnDiag" | "dashHorz" | "dashUpDiag" | "dashVert" | "diagBrick" | "diagCross" | "divot"
 *     | "dkDnDiag" | "dkHorz" | "dkUpDiag" | "dkVert" | "dnDiag" | "dotDmnd" | "dotGrid" | "horz" | "horzBrick" |
 *     "lgCheck" | "lgConfetti" | "lgGrid" | "ltDnDiag" | "ltHorz" | "ltUpDiag" | "ltVert" | "narHorz" | "narVert"
 *     | "openDmnd" | "pct10" | "pct20" | "pct25" | "pct30" | "pct40" | "pct5" | "pct50" | "pct60" | "pct70" |
 *     "pct75" | "pct80" | "pct90" | "plaid" | "shingle" | "smCheck" | "smConfetti" | "smGrid" | "solidDmnd" |
 *     "sphere" | "trellis" | "upDiag" | "vert" | "wave" | "wdDnDiag" | "wdUpDiag" | "weave" | "zigZag"}
 *     PatternType
 */

/**
 *
 * The lock type of the content control.
 * @typedef {"unlocked" | "contentLocked" | "sdtContentLocked" | "sdtLocked"} SdtLock
 */

/**
 * Text transform type.
 * @typedef {("textArchDown" | "textArchDownPour" | "textArchUp" | "textArchUpPour" | "textButton" | "textButtonPour" | "textCanDown"
 * | "textCanUp" | "textCascadeDown" | "textCascadeUp" | "textChevron" | "textChevronInverted" | "textCircle" | "textCirclePour"
 * | "textCurveDown" | "textCurveUp" | "textDeflate" | "textDeflateBottom" | "textDeflateInflate" | "textDeflateInflateDeflate" | "textDeflateTop"
 * | "textDoubleWave1" | "textFadeDown" | "textFadeLeft" | "textFadeRight" | "textFadeUp" | "textInflate" | "textInflateBottom" | "textInflateTop"
 * | "textPlain" | "textRingInside" | "textRingOutside" | "textSlantDown" | "textSlantUp" | "textStop" | "textTriangle" | "textTriangleInverted"
 * | "textWave1" | "textWave2" | "textWave4" | "textNoShape")} TextTransform
 */

/**
 * Form type.
 * The available form types.
 * @typedef {"textForm" | "comboBoxForm" | "dropDownForm" | "checkBoxForm" | "radioButtonForm" | "pictureForm" | "complexForm"} FormType
 */

/**
 * 1 millimetre equals 1/10th of a centimetre.
 * @typedef {number} mm
 */

/**
 * The condition to scale an image in the picture form.
 * @typedef {"always" | "never" | "tooBig" | "tooSmall"} ScaleFlag
 */

/**
 * Value from 0 to 100.
 * @typedef {number} percentage
 */

/**
 * Available highlight colors.
 * @typedef {"black" | "blue" | "cyan" | "green" | "magenta" | "red" | "yellow" | "white" | "darkBlue" |
 * "darkCyan" | "darkGreen" | "darkMagenta" | "darkRed" | "darkYellow" | "darkGray" | "lightGray" | "none"} highlightColor
 */

/**
 * Available values of the "numbered" reference type:
 * <b>"pageNum"</b> - the numbered item page number;
 * <b>"paraNum"</b> - the numbered item paragraph number;
 * <b>"noCtxParaNum"</b> - the abbreviated paragraph number (the specific item only, e.g. instead of "4.1.1" you refer to "1" only);
 * <b>"fullCtxParaNum"</b> - the full paragraph number, e.g. "4.1.1";
 * <b>"text"</b> - the paragraph text value, e.g. if you have "4.1.1. Terms and Conditions", you refer to "Terms and Conditions" only;
 * <b>"aboveBelow"</b> - the words "above" or "below" depending on the item position.
 * @typedef {"pageNum" | "paraNum" | "noCtxParaNum" | "fullCtxParaNum" | "text" | "aboveBelow"} numberedRefTo
 */

/**
 * Available values of the "heading" reference type:
 * <b>"text"</b> - the entire heading text;
 * <b>"pageNum"</b> - the heading page number;
 * <b>"headingNum"</b> - the heading sequence number;
 * <b>"noCtxHeadingNum"</b> - the abbreviated heading number. Make sure the cursor pointer is in the section you are referencing to, e.g. you are in section 4 and you wish to refer to heading 4.B, so instead of "4.B" you receive "B" only;
 * <b>"fullCtxHeadingNum"</b> - the full heading number even if the cursor pointer is in the same section;
 * <b>"aboveBelow"</b> - the words "above" or "below" depending on the item position.
 * @typedef {"text" | "pageNum" | "headingNum" | "noCtxHeadingNum" | "fullCtxHeadingNum" | "aboveBelow"} headingRefTo
 */

/**
 * Available values of the "bookmark" reference type:
 * <b>"text"</b> - the entire bookmark text;
 * <b>"pageNum"</b> - the bookmark page number;
 * <b>"paraNum"</b> - the bookmark paragraph number;
 * <b>"noCtxParaNum"</b> - the abbreviated paragraph number (the specific item only, e.g. instead of "4.1.1" you refer to "1" only);
 * <b>"fullCtxParaNum</b> - the full paragraph number, e.g. "4.1.1";
 * <b>"aboveBelow"</b> - the words "above" or "below" depending on the item position.
 * @typedef {"text" | "pageNum" | "paraNum" | "noCtxParaNum" | "fullCtxParaNum" | "aboveBelow"} bookmarkRefTo
 */

/**
 * Available values of the "footnote" reference type:
 * <b>"footnoteNum"</b> - the footnote number;
 * <b>"pageNum"</b> - the page number of the footnote;
 * <b>"aboveBelow"</b> - the words "above" or "below" depending on the position of the item;
 * <b>"formFootnoteNum"</b> - the form number formatted as a footnote. The numbering of the actual footnotes is not affected.
 * @typedef {"footnoteNum" | "pageNum" | "aboveBelow" | "formFootnoteNum"} footnoteRefTo
 */

/**
 * Available values of the "endnote" reference type:
 * <b>"endnoteNum"</b> - the endnote number;
 * <b>"pageNum"</b> - the endnote page number;
 * <b>"aboveBelow"</b> - the words "above" or "below" depending on the item position;
 * <b>"formEndnoteNum"</b> - the form number formatted as an endnote. The numbering of the actual endnotes is not affected.
 * @typedef {"endnoteNum" | "pageNum" | "aboveBelow" | "formEndnoteNum"} endnoteRefTo
 */

/**
 * Available values of the "equation"/"figure"/"table" reference type:
 * <b>"entireCaption"</b>- the entire caption text;
 * <b>"labelNumber"</b> - the label and object number only, e.g. "Table 1.1";
 * <b>"captionText"</b> - the caption text only;
 * <b>"pageNum"</b> - the page number containing the referenced object;
 * <b>"aboveBelow"</b> - the words "above" or "below" depending on the item position.
 * @typedef {"entireCaption" | "labelNumber" | "captionText" | "pageNum" | "aboveBelow"} captionRefTo
 */

/**
 * Axis position in the chart.
 * @typedef {("top" | "bottom" | "right" | "left")} AxisPos
 */

/**
 * Standard numeric format.
 * @typedef {("General" | "0" | "0.00" | "#,##0" | "#,##0.00" | "0%" | "0.00%" |
 * "0.00E+00" | "# ?/?" | "# ??/??" | "m/d/yyyy" | "d-mmm-yy" | "d-mmm" | "mmm-yy" | "h:mm AM/PM" |
 * "h:mm:ss AM/PM" | "h:mm" | "h:mm:ss" | "m/d/yyyy h:mm" | "#,##0_\);(#,##0)" | "#,##0_\);\[Red\]\(#,##0)" | 
 * "#,##0.00_\);\(#,##0.00\)" | "#,##0.00_\);\[Red\]\(#,##0.00\)" | "mm:ss" | "[h]:mm:ss" | "mm:ss.0" | "##0.0E+0" | "@")} NumFormat
 */

/**
 * Types of all supported forms.
 * @typedef {ApiTextForm | ApiComboBoxForm | ApiCheckBoxForm | ApiPictureForm | ApiDateForm | ApiComplexForm} ApiForm
 */

/**
 * Possible values for the caption numbering format.
 * <b>"ALPHABETIC"</b> - upper letter.
 * <b>"alphabetic"</b> - lower letter.
 * <b>"Roman"</b> - upper Roman.
 * <b>"roman"</b> - lower Roman.
 * <b>"Arabic"</b> - arabic.
 * @typedef {("ALPHABETIC" | "alphabetic" | "Roman" | "roman" | "Arabic")} CaptionNumberingFormat
 */

/**
 * Possible values for the caption separator.
 * <b>"hyphen"</b> - the "-" punctuation mark.
 * <b>"period"</b> - the "." punctuation mark.
 * <b>"colon"</b> - the ":" punctuation mark.
 * <b>"longDash"</b> - the "—" punctuation mark.
 * <b>"dash"</b> - the "-" punctuation mark.
 * @typedef {("hyphen" | "period" | "colon" | "longDash" | "dash")} CaptionSep
 */

/**
 * Possible values for the caption label.
 * @typedef {("Table" | "Equation" | "Figure")} CaptionLabel
 */

/**
 * Table of contents properties.
 * @typedef {Object} TocPr
 * @property {boolean} [ShowPageNums=true] - Specifies whether to show page numbers in the table of contents.
 * @property {boolean} [RightAlgn=true] - Specifies whether to right-align page numbers in the table of contents.
 * @property {TocLeader} [LeaderType="dot"] - The leader type in the table of contents.
 * @property {boolean} [FormatAsLinks=true] - Specifies whether to format the table of contents as links.
 * @property {TocBuildFromPr} [BuildFrom={OutlineLvls=9}] - Specifies whether to generate the table of contents from the outline levels or the specified styles.
 * @property {TocStyle} [TocStyle="standard"] - The table of contents style type.
 */

/**
 * Table of figures properties.
 * @typedef {Object} TofPr
 * @property {boolean} [ShowPageNums=true] - Specifies whether to show page numbers in the table of figures.
 * @property {boolean} [RightAlgn=true] - Specifies whether to right-align page numbers in the table of figures.
 * @property {TocLeader} [LeaderType="dot"] - The leader type in the table of figures.
 * @property {boolean} [FormatAsLinks=true] - Specifies whether to format the table of figures as links.
 * @property {CaptionLabel | string} [BuildFrom="Figure"] - Specifies whether to generate the table of figures based on the specified caption label or the paragraph style name used (for example, "Heading 1").
 * @property {boolean} [LabelNumber=true] - Specifies whether to include the label and number in the table of figures.
 * @property {TofStyle} [TofStyle="distinctive"] - The table of figures style type.
 */

/**
 * Table of contents properties which specify whether to generate the table of contents from the outline levels or the specified styles.
 * @typedef {Object} TocBuildFromPr
 * @property {number} [OutlineLvls=9] - Maximum number of levels in the table of contents.
 * @property {TocStyleLvl[]} StylesLvls - Style levels (for example, [{Name: "Heading 1", Lvl: 2}, {Name: "Heading 2", Lvl: 3}]).
 * <note>If StylesLvls.length > 0, then the OutlineLvls property will be ignored.</note>
 */

/**
 * Table of contents style levels.
 * @typedef {Object} TocStyleLvl
 * @property {string} Name - Style name (for example, "Heading 1").
 * @property {number} Lvl - Level which will be applied to the specified style in the table of contents.
 */

/**
 * Possible values for the table of contents leader:
 * <b>"dot"</b> - "......."
 * <b>"dash"</b> - "-------"
 * <b>"underline"</b> - "_______"
 * @typedef {("dot" | "dash" | "underline" | "none")} TocLeader
 */

/**
 * Possible values for the table of contents style.
 * @typedef {("simple" | "online" | "standard" | "modern" | "classic")} TocStyle
 */

/**
 * Possible values for the table of figures style.
 * @typedef {("simple" | "online" | "classic" | "distinctive" | "centered" | "formal")} TofStyle
 */

/**
 * Any valid drawing element.
 * @typedef {(ApiShape | ApiImage | ApiGroup | ApiOleObject | ApiChart )} Drawing
 */

/**
 * Available drawing element for grouping.
 * @typedef {(ApiShape | ApiGroup | ApiImage | ApiChart)} DrawingForGroup
 */

/**
 * The 1000th of a percent (100000 = 100%).
 * @typedef {number} PositivePercentage
 */

/**
 * The type of tick mark appearance.
 * @typedef {("cross" | "in" | "none" | "out")} TickMark
 */

/**
 * The watermark type.
 * @typedef {("none" | "text" | "image")} WatermarkType
 */

/**
 * The watermark direction.
 * @typedef {("horizontal" | "clockwise45" | "counterclockwise45" | "clockwise90" | "counterclockwise90")} WatermarkDirection
 */

/**
 * The Base64 image string.
 * @typedef {string} Base64Img
 * @example "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgA..."
 */

/**
 * Creates a new paragraph.
 * @memberof ApiInterface
 * @returns {ApiParagraph}
 */
ApiInterface.prototype.CreateParagraph = function(){ return new ApiParagraph(); };

/**
 * Creates a new smaller text block to be inserted to the current paragraph or table.
 * @memberof ApiInterface
 * @returns {ApiRun}
 */
ApiInterface.prototype.CreateRun = function(){ return new ApiRun(); };

/**
 * Creates a new custom geometry
 * @memberof ApiInterface
 * @returns {ApiGeometry}
 */
ApiInterface.prototype.CreateCustomGeometry = function(){ return new ApiGeometry(); };

/**
 * Creates a preset geometry
 * @memberof ApiInterface
 * @param {ShapeType} sPreset - Preset name
 * @returns {ApiGeometry | null}
 */
ApiInterface.prototype.CreatePresetGeometry = function(sPreset){ return new ApiGeometry(); };

/**
 * Creates an RGB color setting the appropriate values for the red, green and blue color components.
 * @memberof ApiInterface
 * @param {byte} r - Red color component value.
 * @param {byte} g - Green color component value.
 * @param {byte} b - Blue color component value.
 * @returns {ApiRGBColor}
 */
ApiInterface.prototype.CreateRGBColor = function(r, g, b){ return new ApiRGBColor(); };

/**
 * Creates a complex color scheme selecting from one of the available schemes.
 * @memberof ApiInterface
 * @param {SchemeColorId} schemeColorId - The color scheme identifier.
 * @returns {ApiSchemeColor}
 */
ApiInterface.prototype.CreateSchemeColor = function(schemeColorId){ return new ApiSchemeColor(); };

/**
 * Creates a color selecting it from one of the available color presets.
 * @memberof ApiInterface
 * @param {PresetColor} presetColor - A preset selected from the list of the available color preset names.
 * @returns {ApiPresetColor};
 */
ApiInterface.prototype.CreatePresetColor = function(presetColor){ return new ApiPresetColor(); };

/**
 * Creates a solid fill to apply to the object using a selected solid color as the object background.
 * @memberof ApiInterface
 * @param {ApiUniColor} uniColor - The color used for the element fill.
 * @returns {ApiFill}
 */
ApiInterface.prototype.CreateSolidFill = function(uniColor){ return new ApiFill(); };

/**
 * Creates a linear gradient fill to apply to the object using the selected linear gradient as the object background.
 * @memberof ApiInterface
 * @param {number[]} gradientStops - The array of gradient color stops measured in 1000th of percent.
 * @param {PositiveFixedAngle} angle - The angle measured in 60000th of a degree that will define the gradient direction.
 * @returns {ApiFill}
 */
ApiInterface.prototype.CreateLinearGradientFill = function(gradientStops, angle){ return new ApiFill(); };

/**
 * Creates a radial gradient fill to apply to the object using the selected radial gradient as the object background.
 * @memberof ApiInterface
 * @param {number[]} gradientStops - The array of gradient color stops measured in 1000th of percent.
 * @returns {ApiFill}
 */
ApiInterface.prototype.CreateRadialGradientFill = function(gradientStops){ return new ApiFill(); };

/**
 * Creates a pattern fill to apply to the object using the selected pattern as the object background.
 * @memberof ApiInterface
 * @param {PatternType} patternType - The pattern type used for the fill selected from one of the available pattern types.
 * @param {ApiUniColor} bgColor - The background color used for the pattern creation.
 * @param {ApiUniColor} fgColor - The foreground color used for the pattern creation.
 * @returns {ApiFill}
 */
ApiInterface.prototype.CreatePatternFill = function(patternType, bgColor, fgColor){ return new ApiFill(); };

/**
 * Creates a blip fill to apply to the object using the selected image as the object background.
 * @memberof ApiInterface
 * @param {string} imageUrl - The path to the image used for the blip fill (currently only internet URL or Base64 encoded images are supported).
 * @param {BlipFillType} blipFillType - The type of the fill used for the blip fill (tile or stretch).
 * @returns {ApiFill}
 */
ApiInterface.prototype.CreateBlipFill = function(imageUrl, blipFillType){ return new ApiFill(); };

/**
 * Creates no fill and removes the fill from the element.
 * @memberof ApiInterface
 * @returns {ApiFill}
 */
ApiInterface.prototype.CreateNoFill = function(){ return new ApiFill(); };

/**
 * Creates a stroke adding shadows to the element.
 * @memberof ApiInterface
 * @param {EMU} width - The width of the shadow measured in English measure units.
 * @param {ApiFill} fill - The fill type used to create the shadow.
 * @returns {ApiStroke}
 */
ApiInterface.prototype.CreateStroke = function(width, fill){ return new ApiStroke(); };

/**
 * Creates a gradient stop used for different types of gradients.
 * @memberof ApiInterface
 * @param {ApiUniColor} uniColor - The color used for the gradient stop.
 * @param {PositivePercentage} pos - The position of the gradient stop measured in 1000th of percent.
 * @returns {ApiGradientStop}
 */
ApiInterface.prototype.CreateGradientStop = function(uniColor, pos){ return new ApiGradientStop(); };

/**
 * Creates a bullet for a paragraph with the character or symbol specified with the sSymbol parameter.
 * @memberof ApiInterface
 * @param {string} sSymbol - The character or symbol which will be used to create the bullet for the paragraph.
 * @returns {ApiBullet}
 */
ApiInterface.prototype.CreateBullet = function(sSymbol){ return new ApiBullet(); };

/**
 * Creates a bullet for a paragraph with the numbering character or symbol specified with the numType parameter.
 * @memberof ApiInterface
 * @param {BulletType} numType - The numbering type the paragraphs will be numbered with.
 * @param {number} startAt - The number the first numbered paragraph will start with.
 * @returns {ApiBullet}
 */
ApiInterface.prototype.CreateNumbering = function(numType, startAt){ return new ApiBullet(); };

/**
 * The checkbox content control properties
 * @typedef {Object} ContentControlCheckBoxPr
 * @property {boolean} [checked] Indicates whether the checkbox is checked by default.
 * @property {string} [checkedSymbol] A custom symbol to display when the checkbox is checked (e.g., "☒").
 * @property {string} [uncheckedSymbol] A custom symbol to display when the checkbox is unchecked (e.g., "☐").
 */

/**
 * The object representing the items in the combo box or drop-down list.
 * @typedef {Object} ContentControlListItem
 * @property {string} display - The text to be displayed in the combo box or drop-down list.
 * @property {string} value - The value associated with the item.
 */

/**
 * The date picker content control properties.
 * @typedef {Object} ContentControlDatePr
 * @property {string} format - The date format. Example: "mm.dd.yyyy".
 * @property {string} lang   - The date language. Possible value for this parameter is a language identifier as defined by
 * RFC 4646/BCP 47. Example: "en-CA".
 */

/**
 * Returns a type of the ApiUnsupported class.
 * @returns {"unsupported"}
 */
ApiUnsupported.prototype.GetClassType = function(){ return ""; };

/**
 * Returns a type of the ApiDocumentContent class. 
 * @memberof ApiDocumentContent
 * @returns {"documentContent"}
 */
ApiDocumentContent.prototype.GetClassType = function(){ return ""; };

/**
 * Returns an internal ID of the current document content.
 * @memberof ApiDocumentContent
 * @returns {string}
 * @since 9.0.4
 */
ApiDocumentContent.prototype.GetInternalId = function(){ return ""; };

/**
 * Returns a number of elements in the current document.
 * @memberof ApiDocumentContent
 * @returns {number}
 */
ApiDocumentContent.prototype.GetElementsCount = function(){ return 0; };

/**
 * Returns an element by its position in the document.
 * @memberof ApiDocumentContent
 * @param {number} nPos - The element position that will be taken from the document.
 * @returns {DocumentElement}
 */
ApiDocumentContent.prototype.GetElement = function(nPos){ return new DocumentElement(); };

/**
 * Adds a paragraph or a table or a blockLvl content control using its position in the document content.
 * @memberof ApiDocumentContent
 * @param {number} nPos - The position where the current element will be added.
 * @param {DocumentElement} oElement - The document element which will be added at the current position.
 * @returns {boolean}
 */
ApiDocumentContent.prototype.AddElement = function(nPos, oElement){ return true; };

/**
 * Pushes a paragraph or a table to actually add it to the document.
 * @memberof ApiDocumentContent
 * @param {DocumentElement} oElement - The element type which will be pushed to the document.
 * @returns {boolean} - returns false if oElement is unsupported.
 */
ApiDocumentContent.prototype.Push = function(oElement){ return true; };

/**
 * Removes all the elements from the current document or from the current document element.
 * <note>When all elements are removed, a new empty paragraph is automatically created. If you want to add
 * content to this paragraph, use the {@link ApiDocumentContent#GetElement} method.</note>
 * @memberof ApiDocumentContent
 * @returns {boolean}
 */
ApiDocumentContent.prototype.RemoveAllElements = function(){ return true; };

/**
 * Removes an element using the position specified.
 * @memberof ApiDocumentContent
 * @param {number} nPos - The element number (position) in the document or inside other element.
 * @returns {boolean}
 */
ApiDocumentContent.prototype.RemoveElement = function(nPos){ return true; };

/**
 * Class representing a custom XML manager, which provides methods to manage custom XML parts in the document.
 * @param doc - The current document.
 * @constructor
 */
function ApiCustomXmlParts(doc){}
ApiCustomXmlParts.prototype = Object.create(ApiCustomXmlParts.prototype);
ApiCustomXmlParts.prototype.constructor = ApiCustomXmlParts;

/**
 * Adds a new custom XML part to the XML manager.
 * @memberof ApiCustomXmlParts
 * @since 9.0.0
 * @param {string} xml - The XML string to be added.
 * @returns {ApiCustomXmlPart} The newly created ApiCustomXmlPart object.
 */
ApiCustomXmlParts.prototype.Add = function(xml){ return new ApiCustomXmlPart(); };

/**
 * Returns a type of the ApiCustomXmlParts class.
 * @memberof ApiCustomXmlParts
 * @returns {"customXmlParts"}
 */
ApiCustomXmlParts.prototype.GetClassType = function(){ return ""; };

/**
 * Returns a custom XML part by its ID from the XML manager.
 * @memberof ApiCustomXmlParts
 * @since 9.0.0
 * @param {string} xmlPartId - The XML part ID.
 * @returns {ApiCustomXmlPart|null} The corresponding ApiCustomXmlPart object if found, or null if no match is found.
 */
ApiCustomXmlParts.prototype.GetById = function(xmlPartId){ return new ApiCustomXmlPart(); };

/**
 * Returns custom XML parts by namespace from the XML manager.
 * @memberof ApiCustomXmlParts
 * @since 9.0.0
 * @param {string} namespace - The namespace of the XML parts.
 * @returns {ApiCustomXmlPart[]} An array of ApiCustomXmlPart objects or null if no matching XML parts are found.
 */
ApiCustomXmlParts.prototype.GetByNamespace = function(namespace){ return [new ApiCustomXmlPart()]; };

/**
 * Returns a number of custom XML parts in the XML manager.
 * @memberof ApiCustomXmlParts
 * @since 9.0.0
 * @returns {number} The number of custom XML parts.
 */
ApiCustomXmlParts.prototype.GetCount = function(){ return 0; };

/**
 * Returns all custom XML parts from the XML manager.
 * @memberof ApiCustomXmlParts
 * @since 9.0.0
 * @returns {ApiCustomXmlPart[]} An array of all custom XML parts.
 */
ApiCustomXmlParts.prototype.GetAll = function(){ return [new ApiCustomXmlPart()]; };

/**
 * Class representing a custom XML part.
 * @constructor
 * @since 9.0.0
 * @param {Object} customXMl - The custom XML object.
 * @param {Object} customXmlManager - The custom XML manager instance.
 * @memberof ApiCustomXmlPart
 */
function ApiCustomXmlPart(customXMl, customXmlManager){}
ApiCustomXmlPart.prototype = Object.create(ApiCustomXmlPart.prototype);
ApiCustomXmlPart.prototype.constructor = ApiCustomXmlPart;

/**
 * Returns a type of the ApiCustomXmlPart class.
 * @memberof ApiCustomXmlPart
 * @returns {"customXmlPart"}
 */
ApiCustomXmlPart.prototype.GetClassType = function(){ return ""; };

/**
 * Returns the ID of the custom XML part.
 * @memberof ApiCustomXmlPart
 * @returns {string}
 */
ApiCustomXmlPart.prototype.GetId = function(){ return ""; };

/**
 * Retrieves nodes from custom XML based on the provided XPath.
 * @memberof ApiCustomXmlPart
 * @since 9.0.0
 * @param {string} xPath - The XPath expression to search for nodes.
 * @returns {ApiCustomXmlNode[]} An array of ApiCustomXmlNode objects corresponding to the found nodes.
 */
ApiCustomXmlPart.prototype.GetNodes = function(xPath){ return [new ApiCustomXmlNode()]; };

/**
 * Retrieves the XML string from the custom XML part.
 * @memberof ApiCustomXmlPart
 * @since 9.0.0
 * @returns {string} The XML string.
 */
ApiCustomXmlPart.prototype.GetXml = function(){ return ""; };

/**
 * Deletes the XML from the custom XML manager.
 * @memberof ApiCustomXmlPart
 * @since 9.0.0
 * @returns {boolean} True if the XML was successfully deleted.
 */
ApiCustomXmlPart.prototype.Delete = function(){ return true; };

/**
 * Deletes an attribute from the XML node at the specified XPath.
 * @memberof ApiCustomXmlPart
 * @since 9.0.0
 * @param {string} xPath - The XPath of the node from which to delete the attribute.
 * @param {string} name - The name of the attribute to delete.
 * @returns {boolean} True if the attribute was successfully deleted.
 */
ApiCustomXmlPart.prototype.DeleteAttribute = function(xPath, name){ return true; };

/**
 * Inserts an attribute into the XML node at the specified XPath.
 * @memberof ApiCustomXmlPart
 * @since 9.0.0
 * @param {string} xPath - The XPath of the node to insert the attribute into.
 * @param {string} name - The name of the attribute to insert.
 * @param {string} value - The value of the attribute to insert.
 * @returns {boolean} True if the attribute was successfully inserted.
 */
ApiCustomXmlPart.prototype.InsertAttribute = function(xPath, name, value){ return true; };

/**
 * Returns an attribute from the XML node at the specified XPath.
 * @memberof ApiCustomXmlPart
 * @since 9.0.0
 * @param {string} xPath - The XPath of the node from which to get the attribute.
 * @param {string} name - The name of the attribute to find.
 * @returns {string | null} The attribute value or null if no matching attributes are found.
 */
ApiCustomXmlPart.prototype.GetAttribute = function(xPath, name){ return ""; };

/**
 * Updates an attribute of the XML node at the specified XPath.
 * @memberof ApiCustomXmlPart
 * @since 9.0.0
 * @param {string} xPath - The XPath of the node whose attribute should be updated.
 * @param {string} name - The name of the attribute to update.
 * @param {string} value - The new value for the attribute.
 * @returns {boolean} True if the attribute was successfully updated.
 */
ApiCustomXmlPart.prototype.UpdateAttribute = function(xPath, name, value){ return true; };

/**
 * Deletes an XML element at the specified XPath.
 * @memberof ApiCustomXmlPart
 * @since 9.0.0
 * @param {string} xPath - The XPath of the node to delete.
 * @returns {boolean} True if the element was successfully deleted.
 */
ApiCustomXmlPart.prototype.DeleteElement = function(xPath){ return true; };

/**
 * Inserts an XML element at the specified XPath.
 * @memberof ApiCustomXmlPart
 * @since 9.0.0
 * @param {string} xPath - The XPath of the parent node where the new element will be inserted.
 * @param {string} xmlStr - The XML string to insert.
 * @param {number} [index] - The position at which to insert the new XML element. If omitted, the element will be appended as the last child.
 * @returns {boolean} True if the insertion was successful.
 */
ApiCustomXmlPart.prototype.InsertElement = function(xPath, xmlStr, index){ return true; };

/**
 * Updates an XML element at the specified XPath.
 * @memberof ApiCustomXmlPart
 * @since 9.0.0
 * @param {string} xPath - The XPath of the node to update.
 * @param {string} xmlStr - The XML string to replace the node content with.
 * @returns {boolean} True if the update was successful.
 */
ApiCustomXmlPart.prototype.UpdateElement = function(xPath, xmlStr){ return true; };

/**
 * Class representing a custom XML node.
 * @constructor
 * @since 9.0.0
 * @param xmlNode - The custom XML node.
 * @param xmlPart - The custom XML part.
 */
function ApiCustomXmlNode(xmlNode, xmlPart){}
ApiCustomXmlNode.prototype = Object.create(ApiCustomXmlNode.prototype);
ApiCustomXmlNode.prototype.constructor = ApiCustomXmlNode;

/**
 * Returns a type of the ApiCustomXmlNode class.
 * @memberof ApiCustomXmlNode
 * @returns {"customXmlNode"}
 */
ApiCustomXmlNode.prototype.GetClassType = function(){ return ""; };

/**
 * Returns nodes from the custom XML node based on the given XPath.
 * @memberof ApiCustomXmlNode
 * @since 9.0.0
 * @param {string} xPath - The XPath expression to match nodes.
 * @returns {ApiCustomXmlNode[]} An array of nodes that match the given XPath.
 */
ApiCustomXmlNode.prototype.GetNodes = function(xPath){ return [new ApiCustomXmlNode()]; };

/**
 * Returns the absolute XPath of the current XML node.
 * @memberof ApiCustomXmlNode
 * @since 9.0.0
 * @returns {string} The absolute XPath of the current node.
 */
ApiCustomXmlNode.prototype.GetXPath = function(){ return ""; };

/**
 * Returns the name of the current XML node.
 * @memberof ApiCustomXmlNode
 * @since 9.0.0
 * @returns {string} The name of the current node.
 */
ApiCustomXmlNode.prototype.GetNodeName = function(){ return ""; };

/**
 * Returns the XML string representation of the current node content.
 * @memberof ApiCustomXmlNode
 * @since 9.0.0
 * @returns {string} The XML string representation of the current node content.
 */
ApiCustomXmlNode.prototype.GetNodeValue = function(){ return ""; };

/**
 * Returns the XML string of the current node.
 * @memberof ApiCustomXmlNode
 * @since 9.0.0
 * @returns {string} The XML string representation of the current node.
 */
ApiCustomXmlNode.prototype.GetXml = function(){ return ""; };

/**
 * Returns the inner text of the current node and its child nodes.
 * For example: `<text>123<one>4</one></text>` returns `"1234"`.
 * @memberof ApiCustomXmlNode
 * @since 9.0.0
 * @returns {string} The combined text content of the node and its descendants.
 */
ApiCustomXmlNode.prototype.GetText = function(){ return ""; };

/**
 * Sets the XML content for the current node.
 * @memberof ApiCustomXmlNode
 * @since 9.0.0
 * @param {string} xml - The XML string to set as the content of the current node.
 * @returns {boolean} Returns `true` if the XML was successfully set.
 */
ApiCustomXmlNode.prototype.SetNodeValue = function(xml){ return true; };

/**
 * Sets the text content of the current XML node.
 * @memberof ApiCustomXmlNode
 * @since 9.0.0
 * @param {string} str - The text content to set for the node.
 * @returns {boolean} Returns `true` if the text was successfully set.
 */
ApiCustomXmlNode.prototype.SetText = function(str){ return true; };

/**
 * Sets the XML content of the current XML node.
 * @memberof ApiCustomXmlNode
 * @since 9.0.0
 * @param {string} strXml - The XML string to set as the node content.
 * @returns {boolean} Returns `true` if the XML was successfully set.
 */
ApiCustomXmlNode.prototype.SetXml = function(strXml){ return true; };

/**
 * Deletes the current XML node.
 * @memberof ApiCustomXmlNode
 * @since 9.0.0
 * @returns {boolean} Returns `true` if the node was successfully deleted.
 */
ApiCustomXmlNode.prototype.Delete = function(){ return true; };

/**
 * Returns the parent of the current XML node.
 * @memberof ApiCustomXmlNode
 * @since 9.0.0
 * @returns {ApiCustomXmlNode | null} The parent node, or `null` if the current node has no parent.
 */
ApiCustomXmlNode.prototype.GetParent = function(){ return new ApiCustomXmlNode(); };

/**
 * Creates a child node for the current XML node.
 * @memberof ApiCustomXmlNode
 * @since 9.0.0
 * @param {string} nodeName - The name of the new child node.
 * @returns {ApiCustomXmlNode} The newly created child node.
 */
ApiCustomXmlNode.prototype.Add = function(nodeName){ return new ApiCustomXmlNode(); };

/**
 * Represents an attribute of an XML node.
 * @typedef {Object} CustomXmlNodeAttribute
 * @property {string} name - The attribute name.
 * @property {string} value - The attribute value.
 */

/**
 * Returns a list of attributes of the current XML node.
 * @memberof ApiCustomXmlNode
 * @since 9.0.0
 * @returns {CustomXmlNodeAttribute[]} An array of attribute objects.
 */
ApiCustomXmlNode.prototype.GetAttributes = function(){ return [new CustomXmlNodeAttribute()]; };

/**
 * Sets an attribute for the custom XML node.
 * If the attribute already exists, it will not be modified.
 * @memberof ApiCustomXmlNode
 * @since 9.0.0
 * @param {string} name - The name of the attribute to set.
 * @param {string} value - The value to assign to the attribute.
 * @returns {boolean} Returns `true` if the attribute was successfully set, `false` if the attribute already exists.
 */
ApiCustomXmlNode.prototype.SetAttribute = function(name, value){ return true; };

/**
 * Updates the value of an existing attribute in the custom XML node.
 * If the attribute doesn't exist, the update will not occur.
 * @memberof ApiCustomXmlNode
 * @since 9.0.0
 * @param {string} name - The name of the attribute to update.
 * @param {string} value - The new value to assign to the attribute.
 * @returns {boolean} Returns `true` if the attribute was successfully updated, `false` if the attribute doesn't exist.
 */
ApiCustomXmlNode.prototype.UpdateAttribute = function(name, value){ return true; };

/**
 * Deletes an attribute from the custom XML node.
 * If the attribute exists, it will be removed.
 * @memberof ApiCustomXmlNode
 * @since 9.0.0
 * @param {string} name - The name of the attribute to delete.
 * @returns {boolean} Returns `true` if the attribute was successfully deleted, `false` if the attribute didn't exist.
 */
ApiCustomXmlNode.prototype.DeleteAttribute = function(name){ return true; };

/**
 * Retrieves the attribute value from the custom XML node.
 * If the attribute doesn't exist, it returns `false`.
 * @memberof ApiCustomXmlNode
 * @since 9.0.0
 * @param {string} name - The name of the attribute to retrieve.
 * @returns {string |null} The value of the attribute if it exists, or `null` if the attribute is not found.
 */
ApiCustomXmlNode.prototype.GetAttribute = function(name){ return ""; };

/**
 * Represents a single comment record.
 * @typedef {Object} CommentReportRecord
 * @property {boolean} IsAnswer Specifies whether the comment is a response.
 * @property {string} CommentMessage The comment text.
 * @property {number} Date The comment local timestamp.
 * @property {number} DateUTC The  comment UTC timestamp.
 * @property {string} [QuoteText] The quoted text (if available).
 */

/**
 * Represents a user's comment history.
 * @typedef {Object} UserComments
 * @property {CommentReportRecord[]} comments A list of comments.
 */

/**
 * A dictionary of users and their comments.
 * @typedef {Object} CommentReport
 * @property {UserComments} [username] The comments grouped by username.
 * @example
 * {
 *   "John Smith": {
 *     comments: [
 *       { IsAnswer: false, CommentMessage: "Good text", Date: 1688588002698, DateUTC: 1688570002698, QuoteText: "Some text" },
 *       { IsAnswer: true, CommentMessage: "I don't think so", Date: 1688588012661, DateUTC: 1688570012661 }
 *     ]
 *   },
 *   "Mark Pottato": {
 *     comments: [
 *       { IsAnswer: false, CommentMessage: "Need to change this part", Date: 1688587967245, DateUTC: 1688569967245, QuoteText: "The quick brown fox jumps over the lazy dog" },
 *       { IsAnswer: false, CommentMessage: "We need to add a link", Date: 1688587967245, DateUTC: 1688569967245, QuoteText: "OnlyOffice" }
 *     ]
 *   }
 * }
 */

/**
 * Review record type.
 * @typedef {("TextAdd" | "TextRem" | "ParaAdd" | "ParaRem" | "TextPr" | "ParaPr" | "Unknown")} ReviewReportRecordType
 */

/**
 * Represents a single review change record.
 * @typedef {Object} ReviewReportRecord
 * @property {ReviewReportRecordType} Type The review record type.
 * @property {string} [Value] The review change value (only for "TextAdd" and "TextRem" types).
 * @property {number} Date The timestamp of the change.
 * @property {ApiParagraph | ApiTable} ReviewedElement The element that was reviewed.
 */

/**
 * Represents a user's review history.
 * @typedef {Object} UserReviewChanges
 * @property {ReviewReportRecord[]} reviews A list of review records.
 */

/**
 * A dictionary of users and their review changes.
 * @typedef {Object} ReviewReport
 * @property {UserReviewChanges} [username] The review changes grouped by username.
 * @example
 * {
 *   "John Smith": {
 *     reviews: [
 *       { Type: "TextRem", Value: "Hello, Mark!", Date: 1679941734161, ReviewedElement: ApiParagraph },
 *       { Type: "TextAdd", Value: "Dear Mr. Pottato.", Date: 1679941736189, ReviewedElement: ApiParagraph }
 *     ]
 *   },
 *   "Mark Pottato": {
 *     reviews: [
 *       { Type: "ParaRem", Date: 1679941755942, ReviewedElement: ApiParagraph },
 *       { Type: "TextPr", Date: 1679941757832, ReviewedElement: ApiParagraph }
 *     ]
 *   }
 * }
 */

/**
 * The specific form type.
 * @typedef {("text" | "checkBox" | "picture" | "comboBox" | "dropDownList" | "dateTime" | "radio")} FormSpecificType
 */

/**
 * Form data.
 * @typedef {Object} FormData
 * @property {string} key - The form key. If the current form is a radio button, then this field contains the group key.
 * @property {string | boolean} value - The current field value.
 * @property {string} tag - The form tag.
 * @property {FormSpecificType} type - The form type.
 * @example
 * {
 *   "key" : "CompanyName",
 *   "tag" : "companyName",
 *   "value" : "ONLYOFFICE",
 *   "type" : "text"
 * }
 */

/**
 * Returns a type of the ApiParagraph class.
 * @memberof ApiParagraph
 * @returns {"paragraph"}
 */
ApiParagraph.prototype.GetClassType = function(){ return ""; };

/**
 * Adds some text to the current paragraph.
 * @memberof ApiParagraph
 * @param {string} [sText=""] - The text that we want to insert into the current document element.
 * @returns {ApiRun}
 */
ApiParagraph.prototype.AddText = function(sText){ return new ApiRun(); };

/**
 * Adds a line break to the current position and starts the next element from a new line.
 * @memberof ApiParagraph
 * @returns {ApiRun}
 */
ApiParagraph.prototype.AddLineBreak = function(){ return new ApiRun(); };

/**
 * Returns the paragraph properties.
 * @memberof ApiParagraph
 * @returns {ApiParaPr}
 */
ApiParagraph.prototype.GetParaPr = function(){ return new ApiParaPr(); };

/**
 * Returns a number of elements in the current paragraph.
 * @memberof ApiParagraph
 * @returns {number}
 */
ApiParagraph.prototype.GetElementsCount = function(){ return 0; };

/**
 * Returns a paragraph element using the position specified.
 * @memberof ApiParagraph
 * @param {number} nPos - The position where the element which content we want to get must be located.
 * @returns {ParagraphContent}
 */
ApiParagraph.prototype.GetElement = function(nPos){ return new ParagraphContent(); };

/**
 * Removes an element using the position specified.
 * <note>If the element you remove is the last paragraph element (i.e. all the elements are removed from the paragraph),
 * a new empty run is automatically created. If you want to add
 * content to this run, use the {@link ApiParagraph#GetElement} method.</note>
 * @memberof ApiParagraph
 * @param {number} nPos - The element position which we want to remove from the paragraph.
 * @returns {boolean}
 */
ApiParagraph.prototype.RemoveElement = function(nPos){ return true; };

/**
 * Removes all the elements from the current paragraph.
 * <note>When all the elements are removed from the paragraph, a new empty run is automatically created. If you want to add
 * content to this run, use the {@link ApiParagraph#GetElement} method.</note>
 * @memberof ApiParagraph
 * @returns {boolean}
 */
ApiParagraph.prototype.RemoveAllElements = function(){ return true; };

/**
 * Deletes the current paragraph.
 * @memberof ApiParagraph
 * @returns {boolean} - returns false if paragraph haven't parent.
 */
ApiParagraph.prototype.Delete = function(){ return true; };

/**
 * Returns the next paragraph.
 * @memberof ApiParagraph
 * @returns {ApiParagraph | null} - returns null if paragraph is last.
 */
ApiParagraph.prototype.GetNext = function(){ return new ApiParagraph(); };

/**
 * Returns the previous paragraph.
 * @memberof ApiParagraph
 * @returns {ApiParagraph} - returns null if paragraph is first.
 */
ApiParagraph.prototype.GetPrevious = function(){ return new ApiParagraph(); };

/**
 * Creates a paragraph copy. Ingnore comments, footnote references, complex fields.
 * @memberof ApiParagraph
 * @returns {ApiParagraph}
 */
ApiParagraph.prototype.Copy = function(){ return new ApiParagraph(); };

/**
 * Adds an element to the current paragraph.
 * @memberof ApiParagraph
 * @param {ParagraphContent} oElement - The document element which will be added at the current position. Returns false if the
 * oElement type is not supported by a paragraph.
 * @param {number} [nPos] - The position where the current element will be added. If this value is not
 * specified, then the element will be added at the end of the current paragraph.
 * @returns {boolean} Returns <code>false</code> if the type of <code>oElement</code> is not supported by paragraph
 * content.
 */
ApiParagraph.prototype.AddElement = function(oElement, nPos){ return true; };

/**
 * Adds a tab stop to the current paragraph.
 * @memberof ApiParagraph
 * @returns {ApiRun}
 */
ApiParagraph.prototype.AddTabStop = function(){ return new ApiRun(); };

/**
 * Returns a type of the ApiRun class.
 * @memberof ApiRun
 * @returns {"run"}
 */
ApiRun.prototype.GetClassType = function(){ return ""; };

/**
 * Returns the text properties of the current run.
 * @memberof ApiRun
 * @returns {ApiTextPr}
 */
ApiRun.prototype.GetTextPr = function(){ return new ApiTextPr(); };

/**
 * Clears the content from the current run.
 * @memberof ApiRun
 * @returns {boolean}
 */
ApiRun.prototype.ClearContent = function(){ return true; };

/**
 * Removes all the elements from the current run.
 * @memberof ApiRun
 * @returns {boolean}
 */
ApiRun.prototype.RemoveAllElements = function(){ return true; };

/**
 * Deletes the current run.
 * @memberof ApiRun
 * @returns {boolean}
 */
ApiRun.prototype.Delete = function(){ return true; };

/**
 * Adds some text to the current run.
 * @memberof ApiRun
 * @param {string} sText - The text which will be added to the current run.
 * @returns {boolean}
 */
ApiRun.prototype.AddText = function(sText){ return true; };

/**
 * Adds a line break to the current run position and starts the next element from a new line.
 * @memberof ApiRun
 * @returns {boolean}
 */
ApiRun.prototype.AddLineBreak = function(){ return true; };

/**
 * Adds a tab stop to the current run.
 * @memberof ApiRun
 * @returns {boolean}
 */
ApiRun.prototype.AddTabStop = function(){ return true; };

/**
 * Creates a copy of the current run.
 * @memberof ApiRun
 * @returns {ApiRun}
 */
ApiRun.prototype.Copy = function(){ return new ApiRun(); };

/**
 * Sets the text properties to the current run.
 * @memberof ApiRun
 * @param {ApiTextPr} oTextPr - The text properties that will be set to the current run.
 * @returns {ApiTextPr}  
 */
ApiRun.prototype.SetTextPr = function(oTextPr){ return new ApiTextPr(); };

/**
 * Sets the bold property to the text character.
 * @memberof ApiRun
 * @param {boolean} isBold - Specifies that the contents of the current run are displayed bold.
 * @returns {ApiTextPr}
 */
ApiRun.prototype.SetBold = function(isBold){ return new ApiTextPr(); };

/**
 * Specifies that any lowercase characters in the current text run are formatted for display only as their capital letter character equivalents.
 * @memberof ApiRun
 * @param {boolean} isCaps - Specifies that the contents of the current run are displayed capitalized.
 * @returns {ApiTextPr}
 */
ApiRun.prototype.SetCaps = function(isCaps){ return new ApiTextPr(); };

/**
 * Sets the text color for the current text run in the RGB format.
 * @memberof ApiRun
 * @param {byte} r - Red color component value.
 * @param {byte} g - Green color component value.
 * @param {byte} b - Blue color component value.
 * @param {boolean} [isAuto=false] - If this parameter is set to "true", then r,g,b parameters will be ignored.
 * @returns {ApiTextPr}
 */
ApiRun.prototype.SetColor = function(r, g, b, isAuto){ return new ApiTextPr(); };

/**
 * Specifies that the contents of the current run are displayed with two horizontal lines through each character displayed on the line.
 * @memberof ApiRun
 * @param {boolean} isDoubleStrikeout - Specifies that the contents of the current run are displayed double struck through.
 * @returns {ApiTextPr}
 */
ApiRun.prototype.SetDoubleStrikeout = function(isDoubleStrikeout){ return new ApiTextPr(); };

/**
 * Sets the text color to the current text run.
 * @memberof ApiRun
 * @param {ApiFill} oApiFill - The color or pattern used to fill the text color.
 * @returns {ApiTextPr}
 */
ApiRun.prototype.SetFill = function(oApiFill){ return new ApiTextPr(); };

/**
 * Sets all 4 font slots with the specified font family.
 * @memberof ApiRun
 * @param {string} sFontFamily - The font family or families used for the current text run.
 * @returns {ApiTextPr}
 */
ApiRun.prototype.SetFontFamily = function(sFontFamily){ return new ApiTextPr(); };

/**
 * Returns all font names from all elements inside the current run.
 * @memberof ApiRun
 * @returns {string[]} - The font names used for the current run.
 */
ApiRun.prototype.GetFontNames = function(){ return [""]; };

/**
 * Sets the font size to the characters of the current text run.
 * @memberof ApiRun
 * @param {hps} nSize - The text size value measured in half-points (1/144 of an inch).
 * @returns {ApiTextPr}
 */
ApiRun.prototype.SetFontSize = function(nSize){ return new ApiTextPr(); };

/**
 * Specifies a highlighting color which is applied as a background to the contents of the current run.
 * @memberof ApiRun
 * @param {highlightColor} sColor - Available highlight color.
 * @returns {ApiTextPr}
 */
ApiRun.prototype.SetHighlight = function(sColor){ return new ApiTextPr(); };

/**
 * Sets the italic property to the text character.
 * @memberof ApiRun
 * @param {boolean} isItalic - Specifies that the contents of the current run are displayed italicized.
 * @returns {ApiTextPr}
 */
ApiRun.prototype.SetItalic = function(isItalic){ return new ApiTextPr(); };

/**
 * Specifies the languages which will be used to check spelling and grammar (if requested) when processing
 * the contents of this text run.
 * @memberof ApiRun
 * @param {string} sLangId - The possible value for this parameter is a language identifier as defined by
 * RFC 4646/BCP 47. Example: "en-CA".
 * @returns {ApiTextPr}
 */
ApiRun.prototype.SetLanguage = function(sLangId){ return new ApiTextPr(); };

/**
 * Specifies an amount by which text is raised or lowered for this run in relation to the default
 * baseline of the surrounding non-positioned text.
 * @memberof ApiRun
 * @param {hps} nPosition - Specifies a positive (raised text) or negative (lowered text)
 * measurement in half-points (1/144 of an inch).
 * @returns {ApiTextPr}
 */
ApiRun.prototype.SetPosition = function(nPosition){ return new ApiTextPr(); };

/**
 * Specifies the shading applied to the contents of the current text run.
 * @memberof ApiRun
 * @param {ShdType} sType - The shading type applied to the contents of the current text run.
 * @param {byte} r - Red color component value.
 * @param {byte} g - Green color component value.
 * @param {byte} b - Blue color component value.
 * @returns {ApiTextPr}
 */
ApiRun.prototype.SetShd = function(sType, r, g, b){ return new ApiTextPr(); };

/**
 * Specifies that all the small letter characters in this text run are formatted for display only as their capital
 * letter character equivalents which are two points smaller than the actual font size specified for this text.
 * @memberof ApiRun
 * @param {boolean} isSmallCaps - Specifies if the contents of the current run are displayed capitalized two points smaller or not.
 * @returns {ApiTextPr}
 */
ApiRun.prototype.SetSmallCaps = function(isSmallCaps){ return new ApiTextPr(); };

/**
 * Sets the text spacing measured in twentieths of a point.
 * @memberof ApiRun
 * @param {twips} nSpacing - The value of the text spacing measured in twentieths of a point (1/1440 of an inch).
 * @returns {ApiTextPr}
 */
ApiRun.prototype.SetSpacing = function(nSpacing){ return new ApiTextPr(); };

/**
 * Specifies that the contents of the current run are displayed with a single horizontal line through the center of the line.
 * @memberof ApiRun
 * @param {boolean} isStrikeout - Specifies that the contents of the current run are displayed struck through.
 * @returns {ApiTextPr}
 */
ApiRun.prototype.SetStrikeout = function(isStrikeout){ return new ApiTextPr(); };

/**
 * Specifies that the contents of the current run are displayed along with a line appearing directly below the character
 * (less than all the spacing above and below the characters on the line).
 * @memberof ApiRun
 * @param {boolean} isUnderline - Specifies that the contents of the current run are displayed underlined.
 * @returns {ApiTextPr}
 */
ApiRun.prototype.SetUnderline = function(isUnderline){ return new ApiTextPr(); };

/**
 * Specifies the alignment which will be applied to the contents of the current run in relation to the default appearance of the text run:
 * <b>"baseline"</b> - the characters in the current text run will be aligned by the default text baseline.
 * <b>"subscript"</b> - the characters in the current text run will be aligned below the default text baseline.
 * <b>"superscript"</b> - the characters in the current text run will be aligned above the default text baseline.
 * @memberof ApiRun
 * @param {("baseline" | "subscript" | "superscript")} sType - The vertical alignment type applied to the text contents.
 * @returns {ApiTextPr}
 */
ApiRun.prototype.SetVertAlign = function(sType){ return new ApiTextPr(); };

/**
 * The section break type which defines how the contents of the current section are placed relative to the previous section.
 * WordprocessingML supports five distinct types of section breaks:
 * <b>Next page</b> ("nextPage") - starts a new section on the next page (the default value).
 * <b>Odd</b> ("oddPage") - starts a new section on the next odd-numbered page.
 * <b>Even</b> ("evenPage") - starts a new section on the next even-numbered page.
 * <b>Continuous</b> ("continuous") - starts a new section in the next paragraph.
 * This means that continuous section breaks might not specify certain page-level section properties,
 * since they shall be inherited from the following section.
 * However, these breaks can specify other section properties, such as line numbering and footnote/endnote settings.
 * <b>Column</b> ("nextColumn") - starts a new section in the next column on the page.
 * @typedef {("nextPage" | "oddPage" | "evenPage" | "continuous" | "nextColumn")} SectionBreakType
*/

/**
 * Coordinate value for geometry paths.
 * Can be a guide name from gdLst, a numeric value, or a string representation of a number.
 * @typedef {string | number} GeometryCoordinate
 */

/**
 * Returns a type of the ApiTextPr class.
 * @memberof ApiTextPr
 * @returns {"textPr"}
 */
ApiTextPr.prototype.GetClassType = function(){ return ""; };

/**
 * Sets the bold property to the text character.
 * @memberof ApiTextPr
 * @param {boolean} isBold - Specifies that the contents of the run are displayed bold.
 * @returns {ApiTextPr} - this text properties.
 */
ApiTextPr.prototype.SetBold = function(isBold){ return new ApiTextPr(); };

/**
 * Gets the bold property from the current text properties.
 * @memberof ApiTextPr
 * @returns {boolean}
 * @since 8.1.0
 */
ApiTextPr.prototype.GetBold = function(){ return true; };

/**
 * Sets the italic property to the text character.
 * @memberof ApiTextPr
 * @param {boolean} isItalic - Specifies that the contents of the current run are displayed italicized.
 * @returns {ApiTextPr} - this text properties.
 */
ApiTextPr.prototype.SetItalic = function(isItalic){ return new ApiTextPr(); };

/**
 * Gets the italic property from the current text properties.
 * @memberof ApiTextPr
 * @returns {boolean}
 * @since 8.1.0
 */
ApiTextPr.prototype.GetItalic = function(){ return true; };

/**
 * Specifies that the contents of the run are displayed with a single horizontal line through the center of the line.
 * @memberof ApiTextPr
 * @param {boolean} isStrikeout - Specifies that the contents of the current run are displayed struck through.
 * @returns {ApiTextPr} - this text properties.
 */
ApiTextPr.prototype.SetStrikeout = function(isStrikeout){ return new ApiTextPr(); };

/**
 * Gets the strikeout property from the current text properties.
 * @memberof ApiTextPr
 * @returns {boolean}
 * @since 8.1.0
 */
ApiTextPr.prototype.GetStrikeout = function(){ return true; };

/**
 * Specifies that the contents of the run are displayed along with a line appearing directly below the character
 * (less than all the spacing above and below the characters on the line).
 * @memberof ApiTextPr
 * @param {boolean} isUnderline - Specifies that the contents of the current run are displayed underlined.
 * @returns {ApiTextPr} - this text properties.
 */
ApiTextPr.prototype.SetUnderline = function(isUnderline){ return new ApiTextPr(); };

/**
 * Gets the underline property from the current text properties.
 * @memberof ApiTextPr
 * @returns {boolean}
 * @since 8.1.0
 */
ApiTextPr.prototype.GetUnderline = function(){ return true; };

/**
 * Sets all 4 font slots with the specified font family.
 * @memberof ApiTextPr
 * @param {string} sFontFamily - The font family or families used for the current text run.
 * @returns {ApiTextPr} - this text properties.
 */
ApiTextPr.prototype.SetFontFamily = function(sFontFamily){ return new ApiTextPr(); };

/**
 * Returns the font family from the current text properties.
 * The method automatically calculates the font from the theme if the font was set via the theme.
 * @memberof ApiTextPr
 * param {undefined | "ascii" | "eastAsia" | "hAnsi" | "cs"} [fontSlot="ascii"] - The font slot.
 * If this parameter is not specified, the "ascii" value is used.
 * @returns {string}
 * @since 8.1.0
 */
ApiTextPr.prototype.GetFontFamily = function(fontSlot){ return ""; };

/**
 * Sets the font size to the characters of the current text run.
 * @memberof ApiTextPr
 * @param {hps} nSize - The text size value measured in half-points (1/144 of an inch).
 * @returns {ApiTextPr} - this text properties.
 */
ApiTextPr.prototype.SetFontSize = function(nSize){ return new ApiTextPr(); };

/**
 * Gets the font size from the current text properties.
 * @memberof ApiTextPr
 * @returns {hps}
 * @since 8.1.0
 */
ApiTextPr.prototype.GetFontSize = function(){ return new hps(); };

/**
 * Specifies the alignment which will be applied to the contents of the run in relation to the default appearance of the run text:
 * <b>"baseline"</b> - the characters in the current text run will be aligned by the default text baseline.
 * <b>"subscript"</b> - the characters in the current text run will be aligned below the default text baseline.
 * <b>"superscript"</b> - the characters in the current text run will be aligned above the default text baseline.
 * @memberof ApiTextPr
 * @param {("baseline" | "subscript" | "superscript")} sType - The vertical alignment type applied to the text contents.
 * @returns {ApiTextPr} - this text properties.
 */
ApiTextPr.prototype.SetVertAlign = function(sType){ return new ApiTextPr(); };

/**
 * Sets the text spacing measured in twentieths of a point.
 * @memberof ApiTextPr
 * @param {twips} nSpacing - The value of the text spacing measured in twentieths of a point (1/1440 of an inch).
 * @returns {ApiTextPr} - this text properties.
 */
ApiTextPr.prototype.SetSpacing = function(nSpacing){ return new ApiTextPr(); };

/**
 * Gets the text spacing from the current text properties measured in twentieths of a point.
 * @memberof ApiTextPr
 * @returns {twips}
 * @since 8.1.0
 */
ApiTextPr.prototype.GetSpacing = function(){ return new twips(); };

/**
 * Specifies that the contents of the run are displayed with two horizontal lines through each character displayed on the line.
 * @memberof ApiTextPr
 * @param {boolean} isDoubleStrikeout - Specifies that the contents of the current run are displayed double struck through.
 * @returns {ApiTextPr} - this text properties.
 */
ApiTextPr.prototype.SetDoubleStrikeout = function(isDoubleStrikeout){ return new ApiTextPr(); };

/**
 * Gets the double strikeout property from the current text properties.
 * @memberof ApiTextPr
 * @returns {boolean}
 * @since 8.1.0
 */
ApiTextPr.prototype.GetDoubleStrikeout = function(){ return true; };

/**
 * Specifies that any lowercase characters in the text run are formatted for display only as their capital letter character equivalents.
 * @memberof ApiTextPr
 * @param {boolean} isCaps - Specifies that the contents of the current run are displayed capitalized.
 * @returns {ApiTextPr} - this text properties.
 */
ApiTextPr.prototype.SetCaps = function(isCaps){ return new ApiTextPr(); };

/**
 * Specifies whether the text with the current text properties are capitalized.
 * @memberof ApiTextPr
 * @returns {boolean}
 * @since 8.1.0
 */
ApiTextPr.prototype.GetCaps = function(){ return true; };

/**
 * Specifies that all the small letter characters in the text run are formatted for display only as their capital
 * letter character equivalents which are two points smaller than the actual font size specified for this text.
 * @memberof ApiTextPr
 * @param {boolean} isSmallCaps - Specifies if the contents of the current run are displayed capitalized two points smaller or not.
 * @returns {ApiTextPr} - this text properties.
 */
ApiTextPr.prototype.SetSmallCaps = function(isSmallCaps){ return new ApiTextPr(); };

/**
 * Specifies whether the text with the current text properties are displayed capitalized two points smaller than the actual font size.
 * @memberof ApiTextPr
 * @returns {boolean}
 * @since 8.1.0
 */
ApiTextPr.prototype.GetSmallCaps = function(){ return true; };

/**
 * Sets the text color to the current text run.
 * @memberof ApiTextPr
 * @param {ApiFill} oApiFill - The color or pattern used to fill the text color.
 * @returns {ApiTextPr} - this text properties.
 */
ApiTextPr.prototype.SetFill = function(oApiFill){ return new ApiTextPr(); };

/**
 * Gets the text color from the current text properties.
 * @memberof ApiTextPr
 * @returns {ApiFill}
 * @since 8.1.0
 */
ApiTextPr.prototype.GetFill = function(){ return new ApiFill(); };

/**
 * Sets the text fill to the current text run.
 * @memberof ApiTextPr
 * @param {ApiFill} oApiFill - The color or pattern used to fill the text color.
 * @returns {ApiTextPr} - this text properties.
 */
ApiTextPr.prototype.SetTextFill = function(oApiFill){ return new ApiTextPr(); };

/**
 * Gets the text fill from the current text properties.
 * @memberof ApiTextPr
 * @returns {ApiFill}
 * @since 8.1.0
 */
ApiTextPr.prototype.GetTextFill = function(){ return new ApiFill(); };

/**
 * Sets the text outline to the current text run.
 * @memberof ApiTextPr
 * @param {ApiStroke} oStroke - The stroke used to create the text outline.
 * @returns {ApiTextPr} - this text properties.
 */
ApiTextPr.prototype.SetOutLine = function(oStroke){ return new ApiTextPr(); };

/**
 * Gets the text outline from the current text properties.
 * @memberof ApiTextPr
 * @returns {ApiStroke}
 * @since 8.1.0
 */
ApiTextPr.prototype.GetOutLine = function(){ return new ApiStroke(); };

/**
 * Returns a type of the ApiParaPr class.
 * @memberof ApiParaPr
 * @returns {"paraPr"}
 */
ApiParaPr.prototype.GetClassType = function(){ return ""; };

/**
 * Sets the paragraph left side indentation.
 * @memberof ApiParaPr
 * @param {twips} nValue - The paragraph left side indentation value measured in twentieths of a point (1/1440 of an inch).
 * @returns {boolean}
 */
ApiParaPr.prototype.SetIndLeft = function(nValue){ return true; };

/**
 * Returns the paragraph left side indentation.
 * @memberof ApiParaPr
 * @returns {twips | undefined} - The paragraph left side indentation value measured in twentieths of a point (1/1440 of an inch).
 */
ApiParaPr.prototype.GetIndLeft = function(){ return new twips(); };

/**
 * Sets the paragraph right side indentation.
 * @memberof ApiParaPr
 * @param {twips} nValue - The paragraph right side indentation value measured in twentieths of a point (1/1440 of an inch).
 * @returns {boolean}
 */
ApiParaPr.prototype.SetIndRight = function(nValue){ return true; };

/**
 * Returns the paragraph right side indentation.
 * @memberof ApiParaPr
 * @returns {twips | undefined} - The paragraph right side indentation value measured in twentieths of a point (1/1440 of an inch).
 */
ApiParaPr.prototype.GetIndRight = function(){ return new twips(); };

/**
 * Sets the paragraph first line indentation.
 * @memberof ApiParaPr
 * @param {twips} nValue - The paragraph first line indentation value measured in twentieths of a point (1/1440 of an inch).
 * @returns {boolean}
 */
ApiParaPr.prototype.SetIndFirstLine = function(nValue){ return true; };

/**
 * Returns the paragraph first line indentation.
 * @memberof ApiParaPr
 * @returns {twips | undefined} - The paragraph first line indentation value measured in twentieths of a point (1/1440 of an inch).
 */
ApiParaPr.prototype.GetIndFirstLine = function(){ return new twips(); };

/**
 * Sets the paragraph contents justification.
 * @memberof ApiParaPr
 * @param {("left" | "right" | "both" | "center")} sJc - The justification type that
 * will be applied to the paragraph contents.
 * @returns {boolean}
 */
ApiParaPr.prototype.SetJc = function(sJc){ return true; };

/**
 * Returns the paragraph contents justification.
 * @memberof ApiParaPr
 * @returns {("left" | "right" | "both" | "center" | undefined)} 
 */
ApiParaPr.prototype.GetJc = function(){ return ""; };

/**
 * Sets the paragraph line spacing. If the value of the sLineRule parameter is either 
 * "atLeast" or "exact", then the value of nLine will be interpreted as twentieths of a point. If 
 * the value of the sLineRule parameter is "auto", then the value of the 
 * nLine parameter will be interpreted as 240ths of a line.
 * @memberof ApiParaPr
 * @param {(twips | line240)} nLine - The line spacing value measured either in twentieths of a point (1/1440 of an inch) or in 240ths of a line.
 * @param {("auto" | "atLeast" | "exact")} sLineRule - The rule that determines the measuring units of the line spacing.
 * @returns {boolean}
 */
ApiParaPr.prototype.SetSpacingLine = function(nLine, sLineRule){ return true; };

/**
 * Returns the paragraph line spacing value.
 * @memberof ApiParaPr
 * @returns {twips | line240 | undefined} - to know is twips or line240 use ApiParaPr.prototype.GetSpacingLineRule().
 */
ApiParaPr.prototype.GetSpacingLineValue = function(){ return new twips(); };

/**
 * Returns the paragraph line spacing rule.
 * @memberof ApiParaPr
 * @returns {"auto" | "atLeast" | "exact" | undefined} 
 */
ApiParaPr.prototype.GetSpacingLineRule = function(){ return ""; };

/**
 * Sets the spacing before the current paragraph. If the value of the isBeforeAuto parameter is true, then 
 * any value of the nBefore is ignored. If isBeforeAuto parameter is not specified, then 
 * it will be interpreted as false.
 * @memberof ApiParaPr
 * @param {twips} nBefore - The value of the spacing before the current paragraph measured in twentieths of a point (1/1440 of an inch).
 * @param {boolean} [isBeforeAuto=false] - The true value disables the spacing before the current paragraph.
 * @returns {boolean}
 */
ApiParaPr.prototype.SetSpacingBefore = function(nBefore, isBeforeAuto){ return true; };

/**
 * Returns the spacing before value of the current paragraph.
 * @memberof ApiParaPr
 * @returns {twips} - The value of the spacing before the current paragraph measured in twentieths of a point (1/1440 of an inch).
 */
ApiParaPr.prototype.GetSpacingBefore = function(){ return new twips(); };

/**
 * Sets the spacing after the current paragraph. If the value of the isAfterAuto parameter is true, then 
 * any value of the nAfter is ignored. If isAfterAuto parameter is not specified, then it 
 * will be interpreted as false.
 * @memberof ApiParaPr
 * @param {twips} nAfter - The value of the spacing after the current paragraph measured in twentieths of a point (1/1440 of an inch).
 * @param {boolean} [isAfterAuto=false] - The true value disables the spacing after the current paragraph.
 * @returns {boolean}
 */
ApiParaPr.prototype.SetSpacingAfter = function(nAfter, isAfterAuto){ return true; };

/**
 * Returns the spacing after value of the current paragraph. 
 * @memberof ApiParaPr
 * @returns {twips} - The value of the spacing after the current paragraph measured in twentieths of a point (1/1440 of an inch).
 */
ApiParaPr.prototype.GetSpacingAfter = function(){ return new twips(); };

/**
 * Specifies a sequence of custom tab stops which will be used for any tab characters in the current paragraph.
 * <b>Warning</b>: The lengths of aPos array and aVal array <b>MUST BE</b> equal to each other.
 * @memberof ApiParaPr
 * @param {twips[]} aPos - An array of the positions of custom tab stops with respect to the current page margins
 * measured in twentieths of a point (1/1440 of an inch).
 * @param {TabJc[]} aVal - An array of the styles of custom tab stops, which determines the behavior of the tab
 * stop and the alignment which will be applied to text entered at the current custom tab stop.
 * @returns {boolean}
 */
ApiParaPr.prototype.SetTabs = function(aPos, aVal){ return true; };

/**
 * Sets the bullet or numbering to the current paragraph.
 * @memberof ApiParaPr
 * @param {?ApiBullet} oBullet - The bullet object created with the {@link Api#CreateBullet} or {@link Api#CreateNumbering} method.
 */
ApiParaPr.prototype.SetBullet = function(oBullet){};

/**
 * Sets the outline level for the specified properties.
 * @memberof ApiParaPr
 * @param {Number} [nLvl=undefined] - The outline level. Possible values: 0-8. The 0 value means the basic outline level.
 * To set no outline level, use this method without a parameter.
 * @returns {boolean}
 * @since 8.2.0
 */
ApiParaPr.prototype.SetOutlineLvl = function(nLvl){ return true; };

/**
 * Returns the outline level of the specified properties.
 * @memberof ApiParaPr
 * @returns {Number}
 * @since 8.2.0
 */
ApiParaPr.prototype.GetOutlineLvl = function(){ return 0; };

/**
 * Checks if this is a custom geometry
 * @returns {boolean}
 * @since 9.1.0
 */
ApiGeometry.prototype.IsCustom = function(){ return true; };

/**
 * Gets the preset name if this is a preset geometry
 * @returns {ShapeType | null}
 * @since 9.1.0
 */
ApiGeometry.prototype.GetPreset = function(){ return new ShapeType(); };

/**
 * Gets the number of paths in the geometry
 * @returns {number}
 * @since 9.1.0
 */
ApiGeometry.prototype.GetPathCount = function(){ return 0; };

/**
 * Gets a path by index
 * @param {number} nIndex - Path index
 * @returns {ApiPath}
 * @since 9.1.0
 */
ApiGeometry.prototype.GetPath = function(nIndex){ return new ApiPath(); };

/**
 * Gets all paths
 * @returns {ApiPath[]}
 * @since 9.1.0
 */
ApiGeometry.prototype.GetPaths = function(){ return [new ApiPath()]; };

/**
 * Adds a new path to the geometry
 * @returns {ApiPath | null}
 * @since 9.1.0
 */
ApiGeometry.prototype.AddPath = function(){ return new ApiPath(); };

/**
 * Gets adjustment value by name
 * @param {string} sName - Adjustment name
 * @returns {number | null}
 * @since 9.1.0
 */
ApiGeometry.prototype.GetAdjValue = function(sName){ return 0; };

/**
 * Adds an adjustment value
 * @param {string} sName - Adjustment name
 * @param {number} nValue - Adjustment value
 * @returns {boolean}
 * @since 9.1.0
 */
ApiGeometry.prototype.AddAdj = function(sName, nValue){ return true; };

/**
 * Sets an adjustment value
 * @param {string} sName - Adjustment name
 * @param {number} nValue - Adjustment value
 * @since 9.1.0
 */
ApiGeometry.prototype.SetAdjValue = function(sName, nValue){};

/**
 * Adds a guide (formula)
 * @param {string} sName - Guide name
 * @param {GeometryFormulaType} sFormula - Formula type
 * @param {string} sX - X parameter
 * @param {string} sY - Y parameter
 * @param {string} sZ - Z parameter
 * @returns {boolean}
 * @since 9.1.0
 */
ApiGeometry.prototype.AddGuide = function(sName, sFormula, sX, sY, sZ){ return true; };

/**
 * Sets the text rectangle
 * @param {string} sLeft - Left guide name or value
 * @param {string} sTop - Top guide name or value
 * @param {string} sRight - Right guide name or value
 * @param {string} sBottom - Bottom guide name or value
 * @returns {boolean}
 * @since 9.1.0
 */
ApiGeometry.prototype.SetTextRect = function(sLeft, sTop, sRight, sBottom){ return true; };

/**
 * Adds a connection point
 * @param {string} sAngle - Angle
 * @param {string} sX - X position
 * @param {string} sY - Y position
 * @since 9.1.0
 */
ApiGeometry.prototype.AddConnectionPoint = function(sAngle, sX, sY){};

/**
 * Gets the command type
 * @returns {PathCommandType}
 * @since 9.1.0
 */
ApiPathCommand.prototype.GetType = function(){ return new PathCommandType(); };

/**
 * Gets the X coordinate for moveTo/lineTo commands
 * @returns {string | null}
 * @since 9.1.0
 */
ApiPathCommand.prototype.GetX = function(){ return ""; };

/**
 * Gets the Y coordinate for moveTo/lineTo commands
 * @returns {string | null}
 * @since 9.1.0
 */
ApiPathCommand.prototype.GetY = function(){ return ""; };

/**
 * Gets first control point X for bezier curves
 * @returns {string | null}
 * @since 9.1.0
 */
ApiPathCommand.prototype.GetX0 = function(){ return ""; };

/**
 * Gets first control point Y for bezier curves
 * @returns {string | null}
 * @since 9.1.0
 */
ApiPathCommand.prototype.GetY0 = function(){ return ""; };

/**
 * Gets second control point X for cubic bezier
 * @returns {string | null}
 * @since 9.1.0
 */
ApiPathCommand.prototype.GetX1 = function(){ return ""; };

/**
 * Gets second control point Y for cubic bezier
 * @returns {string | null}
 * @since 9.1.0
 */
ApiPathCommand.prototype.GetY1 = function(){ return ""; };

/**
 * Gets end point X for cubic bezier
 * @returns {string | null}
 * @since 9.1.0
 */
ApiPathCommand.prototype.GetX2 = function(){ return ""; };

/**
 * Gets end point Y for cubic bezier
 * @returns {string | null}
 * @since 9.1.0
 */
ApiPathCommand.prototype.GetY2 = function(){ return ""; };

/**
 * Gets width radius for arc
 * @returns {string | null}
 * @since 9.1.0
 */
ApiPathCommand.prototype.GetWR = function(){ return ""; };

/**
 * Gets height radius for arc
 * @returns {string | null}
 * @since 9.1.0
 */
ApiPathCommand.prototype.GetHR = function(){ return ""; };

/**
 * Gets start angle for arc
 * @returns {string | null}
 * @since 9.1.0
 */
ApiPathCommand.prototype.GetStartAngle = function(){ return ""; };

/**
 * Gets sweep angle for arc
 * @returns {string | null}
 * @since 9.1.0
 */
ApiPathCommand.prototype.GetSweepAngle = function(){ return ""; };

/**
 * Gets whether the path is stroked
 * @returns {boolean}
 * @since 9.1.0
 */
ApiPath.prototype.GetStroke = function(){ return true; };

/**
 * Sets whether the path should be stroked
 * @param {boolean} bStroke - Whether to stroke the path
 * @since 9.1.0
 */
ApiPath.prototype.SetStroke = function(bStroke){};

/**
 * Gets the fill type
 * @returns {PathFillType}
 * @since 9.1.0
 */
ApiPath.prototype.GetFill = function(){ return new PathFillType(); };

/**
 * Sets the fill type for the path
 * @param {PathFillType} sFill - Fill type
 * @since 9.1.0
 */
ApiPath.prototype.SetFill = function(sFill){};

/**
 * Gets the path width
 * @returns {number}
 * @since 9.1.0
 */
ApiPath.prototype.GetWidth = function(){ return 0; };

/**
 * Sets the path width
 * @param {number} nWidth - Width in EMU
 * @since 9.1.0
 */
ApiPath.prototype.SetWidth = function(nWidth){};

/**
 * Gets the path height
 * @returns {number}
 * @since 9.1.0
 */
ApiPath.prototype.GetHeight = function(){ return 0; };

/**
 * Sets the path height
 * @param {number} nHeight - Height in EMU
 * @since 9.1.0
 */
ApiPath.prototype.SetHeight = function(nHeight){};

/**
 * Gets all path commands
 * @returns {ApiPathCommand[]}
 * @since 9.1.0
 */
ApiPath.prototype.GetCommands = function(){ return [new ApiPathCommand()]; };

/**
 * Gets command count
 * @returns {number}
 * @since 9.1.0
 */
ApiPath.prototype.GetCommandCount = function(){ return 0; };

/**
 * Gets a specific command by index
 * @param {number} nIndex - Command index
 * @returns {ApiPathCommand | null}
 * @since 9.1.0
 */
ApiPath.prototype.GetCommand = function(nIndex){ return new ApiPathCommand(); };

/**
 * Moves to a point
 * @param {GeometryCoordinate} x - X coordinate
 * @param {GeometryCoordinate} y - Y coordinate
 * @since 9.1.0
 */
ApiPath.prototype.MoveTo = function(x, y){};

/**
 * Draws a line to a point
 * @param {GeometryCoordinate} x - X coordinate
 * @param {GeometryCoordinate} y - Y coordinate
 * @since 9.1.0
 */
ApiPath.prototype.LineTo = function(x, y){};

/**
 * Draws a cubic bezier curve
 * @param {GeometryCoordinate} x1 - First control point X
 * @param {GeometryCoordinate} y1 - First control point Y
 * @param {GeometryCoordinate} x2 - Second control point X
 * @param {GeometryCoordinate} y2 - Second control point Y
 * @param {GeometryCoordinate} x3 - End point X
 * @param {GeometryCoordinate} y3 - End point Y
 * @since 9.1.0
 */
ApiPath.prototype.CubicBezTo = function(x1, y1, x2, y2, x3, y3){};

/**
 * Draws a quadratic bezier curve
 * @param {GeometryCoordinate} x1 - Control point X
 * @param {GeometryCoordinate} y1 - Control point Y
 * @param {GeometryCoordinate} x2 - End point X
 * @param {GeometryCoordinate} y2 - End point Y
 * @since 9.1.0
 */
ApiPath.prototype.QuadBezTo = function(x1, y1, x2, y2){};

/**
 * Draws an arc
 * @param {GeometryCoordinate} wR - Width radius
 * @param {GeometryCoordinate} hR - Height radius
 * @param {GeometryCoordinate} stAng - Start angle
 * @param {GeometryCoordinate} swAng - Sweep angle Y
 * @since 9.1.0
 */
ApiPath.prototype.ArcTo = function(wR, hR, stAng, swAng){};

/**
 * Closes the current path
 * @since 9.1.0
 */
ApiPath.prototype.Close = function(){};

/**
 * Returns a type of the ApiChart class.
 * @memberof ApiChart
 * @returns {"chart"}
 */
ApiChart.prototype.GetClassType = function(){ return ""; };

/**
 * Returns a type of the chart object.
 * @memberof ApiChart
 * @returns {ChartType}
 */
ApiChart.prototype.GetChartType = function(){ return new ChartType(); };

/**
 *  Specifies the chart title.
 *  @memberof ApiChart
 *  @param {string} sTitle - The title which will be displayed for the current chart.
 *  @param {pt} nFontSize - The text size value measured in points.
 *  @param {boolean} bIsBold - Specifies if the chart title is written in bold font or not.
 * @returns {boolean}
 */
ApiChart.prototype.SetTitle = function (sTitle, nFontSize, bIsBold){ return true; };

/**
 *  Specifies the chart horizontal axis title.
 *  @memberof ApiChart
 *  @param {string} sTitle - The title which will be displayed for the horizontal axis of the current chart.
 *  @param {pt} nFontSize - The text size value measured in points.
 *  @param {boolean} bIsBold - Specifies if the horizontal axis title is written in bold font or not.
 *@returns {boolean}
 */
ApiChart.prototype.SetHorAxisTitle = function (sTitle, nFontSize, bIsBold){ return true; };

/**
 *  Specifies the chart vertical axis title.
 *  @memberof ApiChart
 *  @param {string} sTitle - The title which will be displayed for the vertical axis of the current chart.
 *  @param {pt} nFontSize - The text size value measured in points.
 *  @param {boolean} bIsBold - Specifies if the vertical axis title is written in bold font or not.
 *@returns {boolean}
 */
ApiChart.prototype.SetVerAxisTitle = function (sTitle, nFontSize, bIsBold){ return true; };

/**
 * Specifies the vertical axis orientation.
 * @memberof ApiChart
 * @param {boolean} bIsMinMax - The <code>true</code> value will set the normal data direction for the vertical axis (from minimum to maximum).
 * @returns {boolean}
 */
ApiChart.prototype.SetVerAxisOrientation = function(bIsMinMax){ return true; };

/**
 * Specifies the horizontal axis orientation.
 * @memberof ApiChart
 * @param {boolean} bIsMinMax - The <code>true</code> value will set the normal data direction for the horizontal axis (from minimum to maximum).
 * @returns {boolean}
 */
ApiChart.prototype.SetHorAxisOrientation = function(bIsMinMax){ return true; };

/**
 * Specifies the chart legend position.
 * @memberof ApiChart
 * @param {"left" | "top" | "right" | "bottom" | "none"} sLegendPos - The position of the chart legend inside the chart window.
 * @returns {boolean}
 */
ApiChart.prototype.SetLegendPos = function(sLegendPos){ return true; };

/**
 * Specifies the legend font size.
 * @memberof ApiChart
 * @param {pt} nFontSize - The text size value measured in points.
 * @returns {boolean}
 */
ApiChart.prototype.SetLegendFontSize = function(nFontSize){ return true; };

/**
 * Specifies which chart data labels are shown for the chart.
 * @memberof ApiChart
 * @param {boolean} bShowSerName - Whether to show or hide the source table column names used for the data which the chart will be build from.
 * @param {boolean} bShowCatName - Whether to show or hide the source table row names used for the data which the chart will be build from.
 * @param {boolean} bShowVal - Whether to show or hide the chart data values.
 * @param {boolean} bShowPercent - Whether to show or hide the percent for the data values (works with stacked chart types).
 * @returns {boolean}
 */
ApiChart.prototype.SetShowDataLabels = function(bShowSerName, bShowCatName, bShowVal, bShowPercent){ return true; };

/**
 * Spicifies the show options for data labels.
 * @memberof ApiChart
 * @param {number} nSeriesIndex - The series index from the array of the data used to build the chart from.
 * @param {number} nPointIndex - The point index from this series.
 * @param {boolean} bShowSerName - Whether to show or hide the source table column names used for the data which the chart will be build from.
 * @param {boolean} bShowCatName - Whether to show or hide the source table row names used for the data which the chart will be build from.
 * @param {boolean} bShowVal - Whether to show or hide the chart data values.
 * @param {boolean} bShowPercent - Whether to show or hide the percent for the data values (works with stacked chart types).
 * @returns {boolean}
 */
ApiChart.prototype.SetShowPointDataLabel = function(nSeriesIndex, nPointIndex, bShowSerName, bShowCatName, bShowVal, bShowPercent){ return true; };

/**
 * Spicifies tick labels position for the vertical axis.
 * @memberof ApiChart
 * @param {TickLabelPosition} sTickLabelPosition - The type for the position of chart vertical tick labels.
 * @returns {boolean}
 */
ApiChart.prototype.SetVertAxisTickLabelPosition = function(sTickLabelPosition){ return true; };

/**
 * Spicifies tick labels position for the horizontal axis.
 * @memberof ApiChart
 * @param {TickLabelPosition} sTickLabelPosition - The type for the position of chart horizontal tick labels.
 * @returns {boolean}
 */
ApiChart.prototype.SetHorAxisTickLabelPosition = function(sTickLabelPosition){ return true; };

/**
 * Specifies major tick mark for the horizontal axis.
 * @memberof ApiChart
 * @param {TickMark} sTickMark - The type of tick mark appearance.
 * @returns {boolean}
 */
ApiChart.prototype.SetHorAxisMajorTickMark = function(sTickMark){ return true; };

/**
 * Specifies minor tick mark for the horizontal axis.
 * @memberof ApiChart
 * @param {TickMark} sTickMark - The type of tick mark appearance.
 * @returns {boolean}
 */
ApiChart.prototype.SetHorAxisMinorTickMark = function(sTickMark){ return true; };

/**
 * Specifies major tick mark for the vertical axis.
 * @memberof ApiChart
 * @param {TickMark} sTickMark - The type of tick mark appearance.
 * @returns {boolean}
 */
ApiChart.prototype.SetVertAxisMajorTickMark = function(sTickMark){ return true; };

/**
 * Specifies minor tick mark for the vertical axis.
 * @memberof ApiChart
 * @param {TickMark} sTickMark - The type of tick mark appearance.
 * @returns {boolean}
 */
ApiChart.prototype.SetVertAxisMinorTickMark = function(sTickMark){ return true; };

/**
 * Specifies major vertical gridline visual properties.
 * @memberof ApiChart
 * @param {?ApiStroke} oStroke - The stroke used to create the element shadow.
 * @returns {boolean}
 */
ApiChart.prototype.SetMajorVerticalGridlines = function(oStroke){ return true; };

/**
 * Specifies minor vertical gridline visual properties.
 * @memberof ApiChart
 * @param {?ApiStroke} oStroke - The stroke used to create the element shadow.
 * @returns {boolean}
 */
ApiChart.prototype.SetMinorVerticalGridlines = function(oStroke){ return true; };

/**
 * Specifies major horizontal gridline visual properties.
 * @memberof ApiChart
 * @param {?ApiStroke} oStroke - The stroke used to create the element shadow.
 * @returns {boolean}
 */
ApiChart.prototype.SetMajorHorizontalGridlines = function(oStroke){ return true; };

/**
 * Specifies minor horizontal gridline visual properties.
 * @memberof ApiChart
 * @param {?ApiStroke} oStroke - The stroke used to create the element shadow.
 * @returns {boolean}
 */
ApiChart.prototype.SetMinorHorizontalGridlines = function(oStroke){ return true; };

/**
 * Removes the specified series from the current chart.
 * @memberof ApiChart
 * @param {number} nSeria - The index of the chart series.
 * @returns {boolean}
 */
ApiChart.prototype.RemoveSeria = function(nSeria){ return true; };

/**
 * Sets a style to the current chart by style ID.
 * @memberof ApiChart
 * @param nStyleId - One of the styles available in the editor.
 * @returns {boolean}
 */
ApiChart.prototype.ApplyChartStyle = function(nStyleId){ return true; };

/**
 * Sets the fill to the chart plot area.
 * @memberof ApiChart
 * @param {ApiFill} oFill - The fill type used to fill the plot area.
 * @returns {boolean}
 */
ApiChart.prototype.SetPlotAreaFill = function(oFill){ return true; };

/**
 * Sets the outline to the chart plot area.
 * @memberof ApiChart
 * @param {ApiStroke} oStroke - The stroke used to create the plot area outline.
 * @returns {boolean}
 */
ApiChart.prototype.SetPlotAreaOutLine = function(oStroke){ return true; };

/**
 * Sets the fill to the specified chart series.
 * @memberof ApiChart
 * @param {ApiFill} oFill - The fill type used to fill the series.
 * @param {number} nSeries - The index of the chart series.
 * @param {boolean} [bAll=false] - Specifies if the fill will be applied to all series.
 * @returns {boolean}
 */
ApiChart.prototype.SetSeriesFill = function(oFill, nSeries, bAll){ return true; };

/**
 * Sets the outline to the specified chart series.
 * @memberof ApiChart
 * @param {ApiStroke} oStroke - The stroke used to create the series outline.
 * @param {number} nSeries - The index of the chart series.
 * @param {boolean} [bAll=false] - Specifies if the outline will be applied to all series.
 * @returns {boolean}
 */
ApiChart.prototype.SetSeriesOutLine = function(oStroke, nSeries, bAll){ return true; };

/**
 * Sets the fill to the data point in the specified chart series.
 * @memberof ApiChart
 * @param {ApiFill} oFill - The fill type used to fill the data point.
 * @param {number} nSeries - The index of the chart series.
 * @param {number} nDataPoint - The index of the data point in the specified chart series.
 * @param {boolean} [bAllSeries=false] - Specifies if the fill will be applied to the specified data point in all series.
 * @returns {boolean}
 */
ApiChart.prototype.SetDataPointFill = function(oFill, nSeries, nDataPoint, bAllSeries){ return true; };

/**
 * Sets the outline to the data point in the specified chart series.
 * @memberof ApiChart
 * @param {ApiStroke} oStroke - The stroke used to create the data point outline.
 * @param {number} nSeries - The index of the chart series.
 * @param {number} nDataPoint - The index of the data point in the specified chart series.
 * @param {boolean} bAllSeries - Specifies if the outline will be applied to the specified data point in all series.
 * @returns {boolean}
 */
ApiChart.prototype.SetDataPointOutLine = function(oStroke, nSeries, nDataPoint, bAllSeries){ return true; };

/**
 * Sets the fill to the marker in the specified chart series.
 * @memberof ApiChart
 * @param {ApiFill} oFill - The fill type used to fill the marker.
 * @param {number} nSeries - The index of the chart series.
 * @param {number} nMarker - The index of the marker in the specified chart series.
 * @param {boolean} [bAllMarkers=false] - Specifies if the fill will be applied to all markers in the specified chart series.
 * @returns {boolean}
 */
ApiChart.prototype.SetMarkerFill = function(oFill, nSeries, nMarker, bAllMarkers){ return true; };

/**
 * Sets the outline to the marker in the specified chart series.
 * @memberof ApiChart
 * @param {ApiStroke} oStroke - The stroke used to create the marker outline.
 * @param {number} nSeries - The index of the chart series.
 * @param {number} nMarker - The index of the marker in the specified chart series.
 * @param {boolean} [bAllMarkers=false] - Specifies if the outline will be applied to all markers in the specified chart series.
 * @returns {boolean}
 */
ApiChart.prototype.SetMarkerOutLine = function(oStroke, nSeries, nMarker, bAllMarkers){ return true; };

/**
 * Sets the fill to the chart title.
 * @memberof ApiChart
 * @param {ApiFill} oFill - The fill type used to fill the title.
 * @returns {boolean}
 */
ApiChart.prototype.SetTitleFill = function(oFill){ return true; };

/**
 * Sets the outline to the chart title.
 * @memberof ApiChart
 * @param {ApiStroke} oStroke - The stroke used to create the title outline.
 * @returns {boolean}
 */
ApiChart.prototype.SetTitleOutLine = function(oStroke){ return true; };

/**
 * Sets the fill to the chart legend.
 * @memberof ApiChart
 * @param {ApiFill} oFill - The fill type used to fill the legend.
 * @returns {boolean}
 */
ApiChart.prototype.SetLegendFill = function(oFill){ return true; };

/**
 * Sets the outline to the chart legend.
 * @memberof ApiChart
 * @param {ApiStroke} oStroke - The stroke used to create the legend outline.
 * @returns {boolean}
 */
ApiChart.prototype.SetLegendOutLine = function(oStroke){ return true; };

/**
 * Sets the specified numeric format to the axis values.
 * @memberof ApiChart
 * @param {NumFormat | String} sFormat - Numeric format (can be custom format).
 * @param {AxisPos} - Axis position in the chart.
 * @returns {boolean}
 */
ApiChart.prototype.SetAxieNumFormat = function(sFormat, sAxiePos){ return true; };

/**
 * Returns all series from the chart space.
 * @memberof ApiChart
 * @returns {ApiChartSeries[]}
 */
ApiChart.prototype.GetAllSeries = function(){ return [new ApiChartSeries()]; };

/**
 * Returns the series with a specific index.
 * @memberof ApiChart
 * @param {number} nIdx - Series index.
 * @returns {ApiChartSeries}
 */
ApiChart.prototype.GetSeries = function(nIdx){ return new ApiChartSeries(); };

/**
 * Returns a type of the ApiChartSeries class.
 * @memberof ApiChartSeries
 * @returns {"chartSeries"}
 */
ApiChartSeries.prototype.GetClassType = function(){ return ""; };

/**
 * Tries to change the series type. Returns true if successful.
 * @memberof ApiChartSeries
 * @param {ChartType} sType - Chart type.
 * @returns {boolean}
 */
ApiChartSeries.prototype.ChangeChartType = function(sType){ return true; };

/**
 * Returns a chart type of the current series.
 * @memberof ApiChartSeries
 * @returns {ChartType}
 */
ApiChartSeries.prototype.GetChartType = function(){ return new ChartType(); };

/**
 * Returns a type of the ApiFill class.
 * @memberof ApiFill
 * @returns {"fill"}
 */
ApiFill.prototype.GetClassType = function(){ return ""; };

/**
 * Returns a type of the ApiStroke class.
 * @memberof ApiStroke
 * @returns {"stroke"}
 */
ApiStroke.prototype.GetClassType = function(){ return ""; };

/**
 * Returns a type of the ApiGradientStop class.
 * @memberof ApiGradientStop
 * @returns {"gradientStop"}
 */
ApiGradientStop.prototype.GetClassType = function (){ return ""; };

/**
 * Returns a type of the ApiUniColor class.
 * @memberof ApiUniColor
 * @returns {"uniColor"}
 */
ApiUniColor.prototype.GetClassType = function (){ return ""; };

/**
 * Returns a type of the ApiRGBColor class.
 * @memberof ApiRGBColor
 * @returns {"rgbColor"}
 */
ApiRGBColor.prototype.GetClassType = function (){ return ""; };

/**
 * Returns a type of the ApiSchemeColor class.
 * @memberof ApiSchemeColor
 * @returns {"schemeColor"}
 */
ApiSchemeColor.prototype.GetClassType = function (){ return ""; };

/**
 * Returns a type of the ApiPresetColor class.
 * @memberof ApiPresetColor
 * @returns {"presetColor"}
 */
ApiPresetColor.prototype.GetClassType = function (){ return ""; };

/**
 * Returns a type of the ApiBullet class.
 * @memberof ApiBullet
 * @returns {"bullet"}
 */
ApiBullet.prototype.GetClassType = function(){ return ""; };

/**
 * Replaces each paragraph (or text in cell) in the select with the corresponding text from an array of strings.
 * @memberof ApiInterface
 * @param {string[]} textStrings - An array of replacement strings.
 * @param {string} [tab="\t"] - A character which is used to specify the tab in the source text.
 * @param {string} [newLine="\r\n"] - A character which is used to specify the line break character in the source text.
 * @returns {boolean}
 */
ApiInterface.prototype.ReplaceTextSmart = function(textStrings, tab, newLine){ return true; };

/**
 * Creates the empty text properties.
 * @memberof ApiInterface
 * @returns {ApiTextPr}
 */
ApiInterface.prototype.CreateTextPr = function(){ return new ApiTextPr(); };

/**
 * Returns the full name of the currently opened file.
 * @memberof ApiInterface
 * @returns {string}
 */
ApiInterface.prototype.GetFullName = function(){ return ""; };

/**
 * Returns the full name of the currently opened file.
 * @memberof ApiInterface
 * @returns {string}
 */
ApiInterface.prototype.FullName = ApiInterface.prototype.GetFullName ();

/**
 * Converts pixels to EMUs (English Metric Units).
 *
 * @memberof ApiInterface
 * @returns {number}
 */
ApiInterface.prototype.PixelsToEmus = function Px2Emu(px) { return 0; };

/**
 * Converts millimeters to pixels.
 *
 * @memberof ApiInterface
 * @returns {number}
 */
ApiInterface.prototype.MillimetersToPixels = function Mm2Px(mm) { return 0; };

/**
 * Converts points to centimeters.
 *
 * @memberof ApiInterface
 * @returns {number}
 */
ApiInterface.prototype.PointsToCentimeters = function PointsToCentimeters(pt) { return 0; };

/**
 * Converts points to EMUs (English Metric Units).
 *
 * @memberof ApiInterface
 * @returns {number}
 */
ApiInterface.prototype.PointsToEmus = function PointsToEmus(pt) { return 0; };

/**
 * Converts points to inches.
 *
 * @memberof ApiInterface
 * @returns {number}
 */
ApiInterface.prototype.PointsToInches = function PointsToInches(pt) { return 0; };

/**
 * Converts points to lines (1 line = 12 points).
 *
 * @memberof ApiInterface
 * @returns {number}
 */
ApiInterface.prototype.PointsToLines = function PointsToLines(pt) { return 0; };

/**
 * Converts points to millimeters.
 *
 * @memberof ApiInterface
 * @returns {number}
 */
ApiInterface.prototype.PointsToMillimeters = function PointsToMillimeters(pt) { return 0; };

/**
 * Converts points to picas (1 pica = 12 points).
 *
 * @memberof ApiInterface
 * @returns {number}
 */
ApiInterface.prototype.PointsToPicas = function PointsToPicas(pt) { return 0; };

/**
 * Converts points to pixels.
 *
 * @memberof ApiInterface
 * @returns {number}
 */
ApiInterface.prototype.PointsToPixels = function PointsToPixels(pt) { return 0; };

/**
 * Converts points to twips.
 *
 * @memberof ApiInterface
 * @returns {number}
 */
ApiInterface.prototype.PointsToTwips = function PointsToTwips(pt) { return 0; };

/**
 * Converts centimeters to points.
 *
 * @memberof ApiInterface
 * @returns {number}
 */
ApiInterface.prototype.CentimetersToPoints = function CentimetersToPoints(cm) { return 0; };

/**
 * Converts EMUs (English Metric Units) to points.
 *
 * @memberof ApiInterface
 * @returns {number}
 */
ApiInterface.prototype.EmusToPoints = function EmusToPoints(emu) { return 0; };

/**
 * Converts inches to points.
 *
 * @memberof ApiInterface
 * @returns {number}
 */
ApiInterface.prototype.InchesToPoints = function InchesToPoints(inches) { return 0; };

/**
 * Converts lines to points (1 line = 12 points).
 *
 * @memberof ApiInterface
 * @returns {number}
 */
ApiInterface.prototype.LinesToPoints = function LinesToPoints(lines) { return 0; };

/**
 * Converts millimeters to points.
 *
 * @memberof ApiInterface
 * @returns {number}
 */
ApiInterface.prototype.MillimetersToPoints = function MillimetersToPoints(mm) { return 0; };

/**
 * Converts picas to points.
 *
 * @memberof ApiInterface
 * @returns {number}
 */
ApiInterface.prototype.PicasToPoints = function PicasToPoints(pc) { return 0; };

/**
 * Converts pixels to points.
 *
 * @memberof ApiInterface
 * @returns {number}
 */
ApiInterface.prototype.PixelsToPoints = function PixelsToPoints(px) { return 0; };

/**
 * Converts twips to points.
 *
 * @memberof ApiInterface
 * @returns {number}
 */
ApiInterface.prototype.TwipsToPoints = function TwipsToPoints(twips) { return 0; };

/**
 * Returns a type of the ApiCore class.
 * @memberof ApiCore
 * @returns {"core"}
 * @since 9.0.0
 */
ApiCore.prototype.GetClassType = function () { return ""; };

/**
 * Sets the document category.
 * @memberof ApiCore
 * @param {string} sCategory - The document category.
 * @since 9.0.0
 */
ApiCore.prototype.SetCategory = function (sCategory) {};

/**
 * Returns the document category.
 * @memberof ApiCore
 * @returns {string} - The document category.
 * @since 9.0.0
 */
ApiCore.prototype.GetCategory = function () { return ""; };

/**
 * Sets the document content status.
 * @memberof ApiCore
 * @param {string} sStatus - The document content status.
 * @since 9.0.0
 */
ApiCore.prototype.SetContentStatus = function (sStatus) {};

/**
 * Returns the document content status.
 * @memberof ApiCore
 * @returns {string} - The document content status.
 * @since 9.0.0
 */
ApiCore.prototype.GetContentStatus = function () { return ""; };

/**
 * Sets the document creation date.
 * @memberof ApiCore
 * @param {Date} oCreated - The document creation date.
 * @since 9.0.0
 */
ApiCore.prototype.SetCreated = function (oCreated) {};

/**
 * Returns the document creation date.
 * @memberof ApiCore
 * @returns {Date}- The document creation date.
 * @since 9.0.0
 */
ApiCore.prototype.GetCreated = function () { return new Date(); };

/**
 * Sets the document author.
 * @memberof ApiCore
 * @param {string} sCreator - The document author.
 * @since 9.0.0
 */
ApiCore.prototype.SetCreator = function (sCreator) {};

/**
 * Returns the document author.
 * @memberof ApiCore
 * @returns {string} - The document author.
 * @since 9.0.0
 */
ApiCore.prototype.GetCreator = function () { return ""; };

/**
 * Sets the document description.
 * @memberof ApiCore
 * @param {string} sDescription - The document description.
 * @since 9.0.0
 */
ApiCore.prototype.SetDescription = function (sDescription) {};

/**
 * Returns the document description.
 * @memberof ApiCore
 * @returns {string} - The document description.
 * @since 9.0.0
 */
ApiCore.prototype.GetDescription = function () { return ""; };

/**
 * Sets the document identifier.
 * @memberof ApiCore
 * @param {string} sIdentifier - The document identifier.
 * @since 9.0.0
 */
ApiCore.prototype.SetIdentifier = function (sIdentifier) {};

/**
 * Returns the document identifier.
 * @memberof ApiCore
 * @returns {string} - The document identifier.
 * @since 9.0.0
 */
ApiCore.prototype.GetIdentifier = function () { return ""; };

/**
 * Sets the document keywords.
 * @memberof ApiCore
 * @param {string} sKeywords - The document keywords in the string format.
 * @since 9.0.0
 *
 */
ApiCore.prototype.SetKeywords = function (sKeywords) {};

/**
 * Returns the document keywords.
 * @memberof ApiCore
 * @returns {string} - The document keywords in the string format.
 * @since 9.0.0
 */
ApiCore.prototype.GetKeywords = function () { return ""; };

/**
 * Sets the document language.
 * @memberof ApiCore
 * @param {string} sLanguage - The document language.
 * @since 9.0.0
 */
ApiCore.prototype.SetLanguage = function (sLanguage) {};

/**
 * Returns the document language.
 * @memberof ApiCore
 * @returns {string} - The document language.
 * @since 9.0.0
 */
ApiCore.prototype.GetLanguage = function () { return ""; };

/**
 * Sets the name of the user who last modified the document.
 * @memberof ApiCore
 * @param {string} sLastModifiedBy - The name of the user who last modified the document.
 * @since 9.0.0
 */
ApiCore.prototype.SetLastModifiedBy = function (sLastModifiedBy) {};

/**
 * Returns the name of the user who last modified the document.
 * @memberof ApiCore
 * @returns {string} - The name of the user who last modified the document.
 * @since 9.0.0
 */
ApiCore.prototype.GetLastModifiedBy = function () { return ""; };

/**
 * Sets the date when the document was last printed.
 * @memberof ApiCore
 * @param {Date} oLastPrinted - The date when the document was last printed.
 * @since 9.0.0
 */
ApiCore.prototype.SetLastPrinted = function (oLastPrinted) {};

/**
 * Returns the date when the document was last printed.
 * @memberof ApiCore
 * @returns {Date} - The date when the document was last printed.
 * @since 9.0.0
 */
ApiCore.prototype.GetLastPrinted = function () { return new Date(); };

/**
 * Sets the date when the document was last modified.
 * @memberof ApiCore
 * @param {Date} oModified - The date when the document was last modified.
 * @since 9.0.0
 */
ApiCore.prototype.SetModified = function (oModified) {};

/**
 * Returns the date when the document was last modified.
 * @memberof ApiCore
 * @returns {Date} - The date when the document was last modified.
 * @since 9.0.0
 */
ApiCore.prototype.GetModified = function () { return new Date(); };

/**
 * Sets the document revision.
 * @memberof ApiCore
 * @param {string} sRevision - The document revision.
 * @since 9.0.0
 */
ApiCore.prototype.SetRevision = function (sRevision) {};

/**
 * Returns the document revision.
 * @memberof ApiCore
 * @returns {string} - The document revision.
 * @since 9.0.0
 */
ApiCore.prototype.GetRevision = function () { return ""; };

/**
 * Sets the document subject.
 * @memberof ApiCore
 * @param {string} sSubject - The document subject.
 * @since 9.0.0
 */
ApiCore.prototype.SetSubject = function (sSubject) {};

/**
 * Returns the document subject.
 * @memberof ApiCore
 * @returns {string} - The document subject.
 * @since 9.0.0
 */
ApiCore.prototype.GetSubject = function () { return ""; };

/**
 * Sets the document title.
 * @memberof ApiCore
 * @param {string} sTitle - The document title.
 * @since 9.0.0
 */
ApiCore.prototype.SetTitle = function (sTitle) {};

/**
 * Returns the document title.
 * @memberof ApiCore
 * @returns {string} - The document title.
 * @since 9.0.0
 */
ApiCore.prototype.GetTitle = function () { return ""; };

/**
 * Sets the document version.
 * @memberof ApiCore
 * @param {string} sVersion - The document version.
 * @since 9.0.0
 */
ApiCore.prototype.SetVersion = function (sVersion) {};

/**
 * Returns the document version.
 * @memberof ApiCore
 * @returns {string} - The document version.
 * @since 9.0.0
 */
ApiCore.prototype.GetVersion = function () { return ""; };

/**
 * Returns a type of the ApiCustomProperties class.
 * @memberof ApiCustomProperties
 * @returns {"customProperties"}
 * @since 9.0.0
 */
ApiCustomProperties.prototype.GetClassType = function () { return ""; };

/**
 * Adds a custom property to the document with automatic type detection.
 * @memberof ApiCustomProperties
 * @param {string} name - The custom property name.
 * @param {string | number | boolean | Date} value - The custom property value.
 * @returns {boolean} - Returns false if the type is unsupported.
 * @since 9.0.0
 */
ApiCustomProperties.prototype.Add = function (name, value) { return true; };

/**
 * Returns the value of a custom property by its name.
 * @memberof ApiCustomProperties
 * @param {string} name - The custom property name.
 * @returns {string | number | Date | boolean | null} - The value of the custom property or null if the property does not exist.
 * @since 9.0.0
 */
ApiCustomProperties.prototype.Get = function (name) { return ""; };

/**
 * @param oApiRange
 * @param oTextPr
 * @constructor
 */
function ApiRangeTextPr(oApiRange, oTextPr){}
ApiRangeTextPr.prototype = Object.create(ApiTextPr.prototype);
ApiRangeTextPr.prototype.constructor = ApiRangeTextPr;

/**
 * Class representing a presentation.
 * @constructor
 */
function ApiPresentation(oPresentation){}

/**
 * Class representing a slide master.
 * @constructor
 */
function ApiMaster(oMaster){}

/**
 * Class representing a slide layout.
 * @constructor
 */
function ApiLayout(oLayout){}

/**
 * Class representing a placeholder.
 * @constructor
 */
function ApiPlaceholder(oPh){}

/**
 * Class representing a theme color scheme.
 * @constructor
 */
function ApiThemeColorScheme(oClrScheme, theme){}

/**
 * Class representing a theme format scheme.
 * @constructor
 */
function ApiThemeFormatScheme(ofmtScheme, theme){}

/**
 * Class representing a theme font scheme.
 * @constructor
 */
function ApiThemeFontScheme(ofontScheme, theme){}

/**
 * Class representing a slide.
 * @constructor
 */
function ApiSlide(oSlide){}

/**
 * Class representing a notes page.
 * @constructor
 */
function ApiNotesPage(oNotes) {}

/**
 * Class representing a group of drawings.
 * @constructor
 */
function ApiGroup(oGroup){}
ApiGroup.prototype = Object.create(ApiDrawing.prototype);
ApiGroup.prototype.constructor = ApiGroup;

/**
 * Class representing a table.
 * @param oGraphicFrame
 * @constructor
 */
function ApiTable(oGraphicFrame){}
ApiTable.prototype = Object.create(ApiDrawing.prototype);
ApiTable.prototype.constructor = ApiTable;

/**
 * Class representing a table row.
 * @param oTableRow
 * @constructor
 */
function ApiTableRow(oTableRow){}

/**
 * Class representing a table cell.
 * @param oCell
 * @constructor
 */
function ApiTableCell(oCell){}

/**
 * Twentieths of a point (equivalent to 1/1440th of an inch).
 * @typedef {number} twips
 */

/**
 * 240ths of a line.
 * @typedef {number} line240
 */

/**
 * Half-points (2 half-points = 1 point).
 * @typedef {number} hps
 */

/**
 * A numeric value from 0 to 255.
 * @typedef {number} byte
 */

/**
 * 60000th of a degree (5400000 = 90 degrees).
 * @typedef {number} PositiveFixedAngle
 */

/**
 * A border type.
 * @typedef {("none" | "single")} BorderType
 */

/**
 * Types of custom tab.
 * @typedef {("clear" | "left" | "right" | "center")} TabJc
 */

/**
 * Eighths of a point (24 eighths of a point = 3 points).
 * @typedef {number} pt_8
 */

/**
 * A point.
 * @typedef {number} pt
 */

/**
 * English measure unit. 1 mm = 36000 EMUs, 1 inch = 914400 EMUs.
 * @typedef {number} EMU
 */

/**
 * This type specifies the preset shape geometry that will be used for a shape.
 * @typedef {("accentBorderCallout1" | "accentBorderCallout2" | "accentBorderCallout3" | "accentCallout1" | "accentCallout2" | "accentCallout3" | "actionButtonBackPrevious" | "actionButtonBeginning" | "actionButtonBlank" | "actionButtonDocument" | "actionButtonEnd" | "actionButtonForwardNext" | "actionButtonHelp" | "actionButtonHome" | "actionButtonInformation" | "actionButtonMovie" | "actionButtonReturn" | "actionButtonSound" | "arc" | "bentArrow" | "bentConnector2" | "bentConnector3" | "bentConnector4" | "bentConnector5" | "bentUpArrow" | "bevel" | "blockArc" | "borderCallout1" | "borderCallout2" | "borderCallout3" | "bracePair" | "bracketPair" | "callout1" | "callout2" | "callout3" | "can" | "chartPlus" | "chartStar" | "chartX" | "chevron" | "chord" | "circularArrow" | "cloud" | "cloudCallout" | "corner" | "cornerTabs" | "cube" | "curvedConnector2" | "curvedConnector3" | "curvedConnector4" | "curvedConnector5" | "curvedDownArrow" | "curvedLeftArrow" | "curvedRightArrow" | "curvedUpArrow" | "decagon" | "diagStripe" | "diamond" | "dodecagon" | "donut" | "doubleWave" | "downArrow" | "downArrowCallout" | "ellipse" | "ellipseRibbon" | "ellipseRibbon2" | "flowChartAlternateProcess" | "flowChartCollate" | "flowChartConnector" | "flowChartDecision" | "flowChartDelay" | "flowChartDisplay" | "flowChartDocument" | "flowChartExtract" | "flowChartInputOutput" | "flowChartInternalStorage" | "flowChartMagneticDisk" | "flowChartMagneticDrum" | "flowChartMagneticTape" | "flowChartManualInput" | "flowChartManualOperation" | "flowChartMerge" | "flowChartMultidocument" | "flowChartOfflineStorage" | "flowChartOffpageConnector" | "flowChartOnlineStorage" | "flowChartOr" | "flowChartPredefinedProcess" | "flowChartPreparation" | "flowChartProcess" | "flowChartPunchedCard" | "flowChartPunchedTape" | "flowChartSort" | "flowChartSummingJunction" | "flowChartTerminator" | "foldedCorner" | "frame" | "funnel" | "gear6" | "gear9" | "halfFrame" | "heart" | "heptagon" | "hexagon" | "homePlate" | "horizontalScroll" | "irregularSeal1" | "irregularSeal2" | "leftArrow" | "leftArrowCallout" | "leftBrace" | "leftBracket" | "leftCircularArrow" | "leftRightArrow" | "leftRightArrowCallout" | "leftRightCircularArrow" | "leftRightRibbon" | "leftRightUpArrow" | "leftUpArrow" | "lightningBolt" | "line" | "lineInv" | "mathDivide" | "mathEqual" | "mathMinus" | "mathMultiply" | "mathNotEqual" | "mathPlus" | "moon" | "nonIsoscelesTrapezoid" | "noSmoking" | "notchedRightArrow" | "octagon" | "parallelogram" | "pentagon" | "pie" | "pieWedge" | "plaque" | "plaqueTabs" | "plus" | "quadArrow" | "quadArrowCallout" | "rect" | "ribbon" | "ribbon2" | "rightArrow" | "rightArrowCallout" | "rightBrace" | "rightBracket" | "round1Rect" | "round2DiagRect" | "round2SameRect" | "roundRect" | "rtTriangle" | "smileyFace" | "snip1Rect" | "snip2DiagRect" | "snip2SameRect" | "snipRoundRect" | "squareTabs" | "star10" | "star12" | "star16" | "star24" | "star32" | "star4" | "star5" | "star6" | "star7" | "star8" | "straightConnector1" | "stripedRightArrow" | "sun" | "swooshArrow" | "teardrop" | "trapezoid" | "triangle" | "upArrowCallout" | "upDownArrow" | "upDownArrow" | "upDownArrowCallout" | "uturnArrow" | "verticalScroll" | "wave" | "wedgeEllipseCallout" | "wedgeRectCallout" | "wedgeRoundRectCallout")} ShapeType
 */

/**
* A bullet type which will be added to the paragraph in spreadsheet or presentation.
* @typedef {("None" | "ArabicPeriod"  | "ArabicParenR"  | "RomanUcPeriod" | "RomanLcPeriod" | "AlphaLcParenR" | "AlphaLcPeriod" | "AlphaUcParenR" | "AlphaUcPeriod")} BulletType
 */

/**
 * The available text vertical alignment (used to align text in a shape with a placement for text inside it).
 * @typedef {("top" | "center" | "bottom")} VerticalTextAlign
 */

/**
 * The available color scheme identifiers.
 * @typedef {("accent1" | "accent2" | "accent3" | "accent4" | "accent5" | "accent6" | "bg1" | "bg2" | "dk1" | "dk2" | "lt1" | "lt2" | "tx1" | "tx2")} SchemeColorId
 */

/**
 * The available preset color names.
 * @typedef {("aliceBlue" | "antiqueWhite" | "aqua" | "aquamarine" | "azure" | "beige" | "bisque" | "black" | "blanchedAlmond" | "blue" | "blueViolet" | "brown" | "burlyWood" | "cadetBlue" | "chartreuse" | "chocolate" | "coral" | "cornflowerBlue" | "cornsilk" | "crimson" | "cyan" | "darkBlue" | "darkCyan" | "darkGoldenrod" | "darkGray" | "darkGreen" | "darkGrey" | "darkKhaki" | "darkMagenta" | "darkOliveGreen" | "darkOrange" | "darkOrchid" | "darkRed" | "darkSalmon" | "darkSeaGreen" | "darkSlateBlue" | "darkSlateGray" | "darkSlateGrey" | "darkTurquoise" | "darkViolet" | "deepPink" | "deepSkyBlue" | "dimGray" | "dimGrey" | "dkBlue" | "dkCyan" | "dkGoldenrod" | "dkGray" | "dkGreen" | "dkGrey" | "dkKhaki" | "dkMagenta" | "dkOliveGreen" | "dkOrange" | "dkOrchid" | "dkRed" | "dkSalmon" | "dkSeaGreen" | "dkSlateBlue" | "dkSlateGray" | "dkSlateGrey" | "dkTurquoise" | "dkViolet" | "dodgerBlue" | "firebrick" | "floralWhite" | "forestGreen" | "fuchsia" | "gainsboro" | "ghostWhite" | "gold" | "goldenrod" | "gray" | "green" | "greenYellow" | "grey" | "honeydew" | "hotPink" | "indianRed" | "indigo" | "ivory" | "khaki" | "lavender" | "lavenderBlush" | "lawnGreen" | "lemonChiffon" | "lightBlue" | "lightCoral" | "lightCyan" | "lightGoldenrodYellow" | "lightGray" | "lightGreen" | "lightGrey" | "lightPink" | "lightSalmon" | "lightSeaGreen" | "lightSkyBlue" | "lightSlateGray" | "lightSlateGrey" | "lightSteelBlue" | "lightYellow" | "lime" | "limeGreen" | "linen" | "ltBlue" | "ltCoral" | "ltCyan" | "ltGoldenrodYellow" | "ltGray" | "ltGreen" | "ltGrey" | "ltPink" | "ltSalmon" | "ltSeaGreen" | "ltSkyBlue" | "ltSlateGray" | "ltSlateGrey" | "ltSteelBlue" | "ltYellow" | "magenta" | "maroon" | "medAquamarine" | "medBlue" | "mediumAquamarine" | "mediumBlue" | "mediumOrchid" | "mediumPurple" | "mediumSeaGreen" | "mediumSlateBlue" | "mediumSpringGreen" | "mediumTurquoise" | "mediumVioletRed" | "medOrchid" | "medPurple" | "medSeaGreen" | "medSlateBlue" | "medSpringGreen" | "medTurquoise" | "medVioletRed" | "midnightBlue" | "mintCream" | "mistyRose" | "moccasin" | "navajoWhite" | "navy" | "oldLace" | "olive" | "oliveDrab" | "orange" | "orangeRed" | "orchid" | "paleGoldenrod" | "paleGreen" | "paleTurquoise" | "paleVioletRed" | "papayaWhip" | "peachPuff" | "peru" | "pink" | "plum" | "powderBlue" | "purple" | "red" | "rosyBrown" | "royalBlue" | "saddleBrown" | "salmon" | "sandyBrown" | "seaGreen" | "seaShell" | "sienna" | "silver" | "skyBlue" | "slateBlue" | "slateGray" | "slateGrey" | "snow" | "springGreen" | "steelBlue" | "tan" | "teal" | "thistle" | "tomato" | "turquoise" | "violet" | "wheat" | "white" | "whiteSmoke" | "yellow" | "yellowGreen")} PresetColor
 */

/**
 * Possible values for the position of chart tick labels (either horizontal or vertical).
 * <b>"none"</b> - not display the selected tick labels.
 * <b>"nextTo"</b> - set the position of the selected tick labels next to the main label.
 * <b>"low"</b> - set the position of the selected tick labels in the part of the chart with lower values.
 * <b>"high"</b> - set the position of the selected tick labels in the part of the chart with higher values.
 * @typedef {("none" | "nextTo" | "low" | "high")} TickLabelPosition
 */

/**
 * The type of a fill which uses an image as a background.
 * <b>"tile"</b> - if the image is smaller than the shape which is filled, the image will be tiled all over the created shape surface.
 * <b>"stretch"</b> - if the image is smaller than the shape which is filled, the image will be stretched to fit the created shape surface.
 * @typedef {"tile" | "stretch"} BlipFillType
 */

/**
 * The available preset patterns which can be used for the fill.
 * @typedef {"cross" | "dashDnDiag" | "dashHorz" | "dashUpDiag" | "dashVert" | "diagBrick" | "diagCross" | "divot" | "dkDnDiag" | "dkHorz" | "dkUpDiag" | "dkVert" | "dnDiag" | "dotDmnd" | "dotGrid" | "horz" | "horzBrick" | "lgCheck" | "lgConfetti" | "lgGrid" | "ltDnDiag" | "ltHorz" | "ltUpDiag" | "ltVert" | "narHorz" | "narVert" | "openDmnd" | "pct10" | "pct20" | "pct25" | "pct30" | "pct40" | "pct5" | "pct50" | "pct60" | "pct70" | "pct75" | "pct80" | "pct90" | "plaid" | "shingle" | "smCheck" | "smConfetti" | "smGrid" | "solidDmnd" | "sphere" | "trellis" | "upDiag" | "vert" | "wave" | "wdDnDiag" | "wdUpDiag" | "weave" | "zigZag"} PatternType
 */

/**
 * The available types of tick mark appearance.
 * @typedef {("cross" | "in" | "none" | "out")} TickMark
 */

/**
 * Text transform type.
 * @typedef {("textArchDown" | "textArchDownPour" | "textArchUp" | "textArchUpPour" | "textButton" | "textButtonPour" | "textCanDown"
 * | "textCanUp" | "textCascadeDown" | "textCascadeUp" | "textChevron" | "textChevronInverted" | "textCircle" | "textCirclePour"
 * | "textCurveDown" | "textCurveUp" | "textDeflate" | "textDeflateBottom" | "textDeflateInflate" | "textDeflateInflateDeflate" | "textDeflateTop"
 * | "textDoubleWave1" | "textFadeDown" | "textFadeLeft" | "textFadeRight" | "textFadeUp" | "textInflate" | "textInflateBottom" | "textInflateTop"
 * | "textPlain" | "textRingInside" | "textRingOutside" | "textSlantDown" | "textSlantUp" | "textStop" | "textTriangle" | "textTriangleInverted"
 * | "textWave1" | "textWave2" | "textWave4" | "textNoShape")} TextTransform
 */

/**
 * Axis position in the chart.
 * @typedef {("top" | "bottom" | "right" | "left")} AxisPos
 */

/**
 * Standard numeric format.
 * @typedef {("General" | "0" | "0.00" | "#,##0" | "#,##0.00" | "0%" | "0.00%" |
 * "0.00E+00" | "# ?/?" | "# ??/??" | "m/d/yyyy" | "d-mmm-yy" | "d-mmm" | "mmm-yy" | "h:mm AM/PM" |
 * "h:mm:ss AM/PM" | "h:mm" | "h:mm:ss" | "m/d/yyyy h:mm" | "#,##0_\);(#,##0)" | "#,##0_\);\[Red\]\(#,##0)" | 
 * "#,##0.00_\);\(#,##0.00\)" | "#,##0.00_\);\[Red\]\(#,##0.00\)" | "mm:ss" | "[h]:mm:ss" | "mm:ss.0" | "##0.0E+0" | "@")} NumFormat
 */

/**
 * @typedef {("body" | "chart" | "clipArt" | "ctrTitle" | "diagram" | "date" | "footer" | "header" | "media" | "object" | "picture" | "sldImage" | "sldNumber" | "subTitle" | "table" | "title")} PlaceholderType - Available placeholder types.
 */

/**
 * @typedef {("blank" | "chart" | "chartAndTx" | "clipArtAndTx" | "clipArtAndVertTx" | "cust" | "dgm" | "fourObj" | "mediaAndTx" | "obj" | "objAndTwoObj" | "objAndTx" | "objOnly" | "objOverTx" | "objTx" | "picTx" | "secHead" | "tbl" | "title" | "titleOnly" | "twoColTx" | "twoObj" | "twoObjAndObj" | "twoObjAndTx" | "twoObjOverTx" | "twoTxTwoObj" | "tx" | "txAndChart" | "txAndClipArt" | "txAndMedia" | "txAndObj" | "txAndTwoObj" | "txOverObj" | "vertTitleAndTx" | "vertTitleAndTxOverChart" | "vertTx")} LayoutType - Available layout types.
 */

/**
 * Any valid drawing element.
 * @typedef {(ApiShape | ApiImage | ApiGroup | ApiOleObject | ApiTable | ApiChart )} Drawing
 */

/**
 * Available drawing element for grouping.
 * @typedef {(ApiShape | ApiGroup | ApiImage | ApiChart)} DrawingForGroup
 */

/**
 * Any valid element which can be added to the document structure.
 * @typedef {(ApiParagraph)} DocumentElement
 */

/**
 * The types of elements that can be added to the paragraph structure.
 * @typedef {(ApiUnsupported | ApiRun | ApiHyperlink)} ParagraphContent
 */

/**
 * The 1000th of a percent (100000 = 100%).
 * @typedef {number} PositivePercentage
 */

/**
 * Represents the type of objects in a selection.
 * @typedef {("none" | "shapes" | "slides" | "text")} SelectionType - Available selection types.
 *
 */

/**
 * Private method to collect all objects of a specific type from the presentation (OleObjects, Charts, Shapes, Images).
 * Calls 'getObjectsMethod' method on each slide, master and layout to get the objects.
 */
ApiPresentation.prototype._collectAllObjects = function (getObjectsMethod) {};

/**
 * Class representing the selection in the presentation.
 * @constructor
 */
function ApiSelection() {}

/**
 * Class representing the currently active workbook
 *
 * @constructor
 */
function ApiWorkbook(workbook) {}

/**
 * The callback function which is called when the specified range of the current sheet changes.
 * <note>Please note that the event is not called for the undo/redo operations.</note>
 * @event Api#onWorksheetChange
 * @param {ApiRange} range - The modified range represented as the ApiRange object.
 */

/**
 * Class representing a sheet.
 * @constructor
 * @property {boolean} Visible - Returns or sets the state of sheet visibility.
 * @property {number} Active - Makes the current sheet active.
 * @property {ApiRange} ActiveCell - Returns an object that represents an active cell.
 * @property {ApiRange} Selection - Returns an object that represents the selected range.
 * @property {ApiRange} Cells - Returns ApiRange that represents all the cells on the worksheet (not just the cells that are currently in use).
 * @property {ApiRange} Rows - Returns ApiRange that represents all the cells of the rows range.
 * @property {ApiRange} Cols - Returns ApiRange that represents all the cells of the columns range.
 * @property {ApiRange} UsedRange - Returns ApiRange that represents the used range on the specified worksheet.
 * @property {string} Name - Returns or sets a name of the active sheet.
 * @property {number} Index - Returns a sheet index.
 * @property {number} LeftMargin - Returns or sets the size of the sheet left margin measured in points.
 * @property {number} RightMargin - Returns or sets the size of the sheet right margin measured in points.
 * @property {number} TopMargin - Returns or sets the size of the sheet top margin measured in points.
 * @property {number} BottomMargin - Returns or sets the size of the sheet bottom margin measured in points.
 * @property {PageOrientation} PageOrientation - Returns or sets the page orientation.
 * @property {boolean} PrintHeadings - Returns or sets the page PrintHeadings property.
 * @property {boolean} PrintGridlines - Returns or sets the page PrintGridlines property.
 * @property {ApiName[]} Defnames - Returns an array of the ApiName objects.
 * @property {ApiComment[]} Comments - Returns all comments from the current worksheet.
 * @property {ApiFreezePanes} FreezePanes - Returns the freeze panes for the current worksheet.
 * @property {ApiProtectedRange[]} AllProtectedRanges - Returns all protected ranges from the current worksheet.
 * @property {ApiPivotTable[]} PivotTables - Returns all pivot tables from the current worksheet.
 */
function ApiWorksheet(worksheet) {}

/**
 * Class representing a range.
 * @constructor
 * @property {number} Row - Returns the row number for the selected cell.
 * @property {number} Col - Returns the column number for the selected cell.
 * @property {ApiRange} Rows - Returns the ApiRange object that represents the rows of the specified range.
 * @property {ApiRange} Cols - Returns the ApiRange object that represents the columns of the specified range.
 * @property {ApiRange} Columns - Returns the ApiRange object that represents the columns of the specified range.
 * @property {ApiRange} Cells - Returns a Range object that represents all the cells in the specified range or a specified cell.
 * @property {ApiRange} EntireRow - Returns a Range object that represents the entire row(s) that contains the specified range.
 * @property {ApiRange} EntireColumn - Returns a Range object that represents the entire column(s) that contains the specified range.
 * @property {number} Count - Returns the rows or columns count.
 * @property {string} Address - Returns the range address.
 * @property {string} Value - Returns a value from the first cell of the specified range or sets it to this cell.
 * @property {string} Formula - Returns a formula from the first cell of the specified range or sets it to this cell.
 * @property {string} Value2 - Returns the value2 (value without format) from the first cell of the specified range or sets it to this cell.
 * @property {string} Text - Returns the text from the first cell of the specified range or sets it to this cell.
 * @property {ApiColor} FontColor - Sets the text color to the current cell range with the previously created color object.
 * @property {boolean} Hidden - Returns or sets the value hiding property.
 * @property {number} ColumnWidth - Returns or sets the width of all the columns in the specified range measured in points.
 * @property {number} Width - Returns a value that represents the range width measured in points.
 * @property {number} RowHeight - Returns or sets the height of the first row in the specified range measured in points.
 * @property {number} Height - Returns a value that represents the range height measured in points.
 * @property {number} FontSize - Sets the font size to the characters of the current cell range.
 * @property {string} FontName - Sets the specified font family as the font name for the current cell range.
 * @property {'center' | 'bottom' | 'top' | 'distributed' | 'justify'} AlignVertical - Sets the text vertical alignment to the current cell range.
 * @property {'left' | 'right' | 'center' | 'justify'} AlignHorizontal - Sets the text horizontal alignment to the current cell range.
 * @property {'context' | 'ltr' | 'rtl'} ReadingOrder - Sets the direction (reading order) of the text in the current cell range.
 * @property {boolean} Bold - Sets the bold property to the text characters from the current cell or cell range.
 * @property {boolean} Italic - Sets the italic property to the text characters in the current cell or cell range.
 * @property {'none' | 'single' | 'singleAccounting' | 'double' | 'doubleAccounting'} Underline - Sets the type of underline applied to the font.
 * @property {boolean} Strikeout - Sets a value that indicates whether the contents of the current cell or cell range are displayed struck through.
 * @property {boolean} WrapText - Returns the information about the wrapping cell style or specifies whether the words in the cell must be wrapped to fit the cell size or not.
 * @property {ApiColor|'No Fill'} FillColor - Returns or sets the background color of the current cell range.
 * @property {string} NumberFormat - Sets a value that represents the format code for the object.
 * @property {ApiRange} MergeArea - Returns the cell or cell range from the merge area.
 * @property {ApiRange} CurrentRegion - Returns a range that represents the expanded range around the current range.
 * @property {ApiWorksheet} Worksheet - Returns the ApiWorksheet object that represents the worksheet containing the specified range.
 * @property {ApiName} DefName - Returns the ApiName object.
 * @property {ApiComment | null} Comments - Returns the ApiComment collection that represents all the comments from the specified worksheet.
 * @property {Angle} Orientation - Returns an angle to the current cell range.
 * @property {ApiAreas} Areas - Returns a collection of the areas.
 * @property {ApiCharacters} Characters - Returns the ApiCharacters object that represents a range of characters within the object text. Use the ApiCharacters object to format characters within a text string.
 * @property {ApiPivotTable | null} PivotTable - Returns the ApiPivotTable object that represents the pivot table report containing the upper-left corner of the specified range.
 */
function ApiRange(range, areas) {}

/**
 * Class representing a graphical object.
 * @constructor
 */
function ApiDrawing(Drawing) {}

/**
 * Class representing a shape.
 * @constructor
 */
function ApiShape(oShape) {}
ApiShape.prototype = Object.create(ApiDrawing.prototype);
ApiShape.prototype.constructor = ApiShape;

/**
 * Class representing an image.
 * @constructor
 */
function ApiImage(oImage) {}
ApiImage.prototype = Object.create(ApiDrawing.prototype);
ApiImage.prototype.constructor = ApiImage;

/**
 * Class representing an OLE object.
 * @constructor
 */
function ApiOleObject(OleObject) {}
ApiOleObject.prototype = Object.create(ApiDrawing.prototype);
ApiOleObject.prototype.constructor = ApiOleObject;

/**
 * The available preset color names.
 * @typedef {("aliceBlue" | "antiqueWhite" | "aqua" | "aquamarine" | "azure" | "beige" | "bisque" | "black" |
 *     "blanchedAlmond" | "blue" | "blueViolet" | "brown" | "burlyWood" | "cadetBlue" | "chartreuse" | "chocolate"
 *     | "coral" | "cornflowerBlue" | "cornsilk" | "crimson" | "cyan" | "darkBlue" | "darkCyan" | "darkGoldenrod" |
 *     "darkGray" | "darkGreen" | "darkGrey" | "darkKhaki" | "darkMagenta" | "darkOliveGreen" | "darkOrange" |
 *     "darkOrchid" | "darkRed" | "darkSalmon" | "darkSeaGreen" | "darkSlateBlue" | "darkSlateGray" |
 *     "darkSlateGrey" | "darkTurquoise" | "darkViolet" | "deepPink" | "deepSkyBlue" | "dimGray" | "dimGrey" |
 *     "dkBlue" | "dkCyan" | "dkGoldenrod" | "dkGray" | "dkGreen" | "dkGrey" | "dkKhaki" | "dkMagenta" |
 *     "dkOliveGreen" | "dkOrange" | "dkOrchid" | "dkRed" | "dkSalmon" | "dkSeaGreen" | "dkSlateBlue" |
 *     "dkSlateGray" | "dkSlateGrey" | "dkTurquoise" | "dkViolet" | "dodgerBlue" | "firebrick" | "floralWhite" |
 *     "forestGreen" | "fuchsia" | "gainsboro" | "ghostWhite" | "gold" | "goldenrod" | "gray" | "green" |
 *     "greenYellow" | "grey" | "honeydew" | "hotPink" | "indianRed" | "indigo" | "ivory" | "khaki" | "lavender" |
 *     "lavenderBlush" | "lawnGreen" | "lemonChiffon" | "lightBlue" | "lightCoral" | "lightCyan" |
 *     "lightGoldenrodYellow" | "lightGray" | "lightGreen" | "lightGrey" | "lightPink" | "lightSalmon" |
 *     "lightSeaGreen" | "lightSkyBlue" | "lightSlateGray" | "lightSlateGrey" | "lightSteelBlue" | "lightYellow" |
 *     "lime" | "limeGreen" | "linen" | "ltBlue" | "ltCoral" | "ltCyan" | "ltGoldenrodYellow" | "ltGray" |
 *     "ltGreen" | "ltGrey" | "ltPink" | "ltSalmon" | "ltSeaGreen" | "ltSkyBlue" | "ltSlateGray" | "ltSlateGrey"|
 *     "ltSteelBlue" | "ltYellow" | "magenta" | "maroon" | "medAquamarine" | "medBlue" | "mediumAquamarine" |
 *     "mediumBlue" | "mediumOrchid" | "mediumPurple" | "mediumSeaGreen" | "mediumSlateBlue" |
 *     "mediumSpringGreen" | "mediumTurquoise" | "mediumVioletRed" | "medOrchid" | "medPurple" | "medSeaGreen" |
 *     "medSlateBlue" | "medSpringGreen" | "medTurquoise" | "medVioletRed" | "midnightBlue" | "mintCream" |
 *     "mistyRose" | "moccasin" | "navajoWhite" | "navy" | "oldLace" | "olive" | "oliveDrab" | "orange" |
 *     "orangeRed" | "orchid" | "paleGoldenrod" | "paleGreen" | "paleTurquoise" | "paleVioletRed" | "papayaWhip"|
 *     "peachPuff" | "peru" | "pink" | "plum" | "powderBlue" | "purple" | "red" | "rosyBrown" | "royalBlue" |
 *     "saddleBrown" | "salmon" | "sandyBrown" | "seaGreen" | "seaShell" | "sienna" | "silver" | "skyBlue" |
 *     "slateBlue" | "slateGray" | "slateGrey" | "snow" | "springGreen" | "steelBlue" | "tan" | "teal" |
 *     "thistle" | "tomato" | "turquoise" | "violet" | "wheat" | "white" | "whiteSmoke" | "yellow" |
 *     "yellowGreen")} PresetColor
 */

/**
 * Possible values for the position of chart tick labels (either horizontal or vertical).
 * <b>"none"</b> - does not display the selected tick labels.
 * <b>"nextTo"</b> - sets the position of the selected tick labels next to the main label.
 * <b>"low"</b> - sets the position of the selected tick labels in the part of the chart with lower values.
 * <b>"high"</b> - sets the position of the selected tick labels in the part of the chart with higher values.
 * @typedef {("none" | "nextTo" | "low" | "high")} TickLabelPosition
 */

/**
 * The page orientation type.
 * @typedef {("xlLandscape" | "xlPortrait")} PageOrientation
 */

/**
 * The type of tick mark appearance.
 * @typedef {("cross" | "in" | "none" | "out")} TickMark
 */

/**
 * Text transform type.
 * @typedef {("textArchDown" | "textArchDownPour" | "textArchUp" | "textArchUpPour" | "textButton" | "textButtonPour" | "textCanDown"
 * | "textCanUp" | "textCascadeDown" | "textCascadeUp" | "textChevron" | "textChevronInverted" | "textCircle" | "textCirclePour"
 * | "textCurveDown" | "textCurveUp" | "textDeflate" | "textDeflateBottom" | "textDeflateInflate" | "textDeflateInflateDeflate" | "textDeflateTop"
 * | "textDoubleWave1" | "textFadeDown" | "textFadeLeft" | "textFadeRight" | "textFadeUp" | "textInflate" | "textInflateBottom" | "textInflateTop"
 * | "textPlain" | "textRingInside" | "textRingOutside" | "textSlantDown" | "textSlantUp" | "textStop" | "textTriangle" | "textTriangleInverted"
 * | "textWave1" | "textWave2" | "textWave4" | "textNoShape")} TextTransform
 */

/**
 * Axis position in the chart.
 * @typedef {("top" | "bottom" | "right" | "left")} AxisPos
 */

/**
 * Standard numeric format.
 * @typedef {("General" | "0" | "0.00" | "#,##0" | "#,##0.00" | "0%" | "0.00%" |
 * "0.00E+00" | "# ?/?" | "# ??/??" | "m/d/yyyy" | "d-mmm-yy" | "d-mmm" | "mmm-yy" | "h:mm AM/PM" |
 * "h:mm:ss AM/PM" | "h:mm" | "h:mm:ss" | "m/d/yyyy h:mm" | "#,##0_\);(#,##0)" | "#,##0_\);\[Red\]\(#,##0)" | 
 * "#,##0.00_\);\(#,##0.00\)" | "#,##0.00_\);\[Red\]\(#,##0.00\)" | "mm:ss" | "[h]:mm:ss" | "mm:ss.0" | "##0.0E+0" | "@")} NumFormat
 */

/**
 * The cell reference type.
 * @typedef {('xlA1' | 'xlR1C1')} ReferenceStyle
 */

/**
 * Specifies the part of the range to be pasted.
 * @typedef {("xlPasteAll" | "xlPasteAllExceptBorders"
 * | "xlPasteColumnWidths" | "xlPasteComments"
 * | "xlPasteFormats" | "xlPasteFormulas" | "xlPasteFormulasAndNumberFormats"
 * | "xlPasteValues" | "xlPasteValuesAndNumberFormats" )} PasteType
 */

/**
 * The mathematical operation which will be applied to the copied data.
 * @typedef {("xlPasteSpecialOperationAdd" | "xlPasteSpecialOperationDivide" | "xlPasteSpecialOperationMultiply"|
 * "xlPasteSpecialOperationNone" | "xlPasteSpecialOperationSubtract" )} PasteSpecialOperation
 */

/**
* Specifies how to shift cells to replace deleted cells.
* @typedef {("up" | "left")} DeleteShiftDirection
*/

/**
 * Any valid drawing element.
 * @typedef {(ApiShape | ApiImage | ApiOleObject | ApiChart )} Drawing
 */

/**
 * The report filter area settings.
 * @typedef {object} PivotTableFilterAreaInfo
 * @property {FieldsInReportFilterType} Type - Specifies how the report filter fields are located.
 * @property {number} ReportFilterFields - Defines the number of the report filter fields.
 */

/**
 * The settings for adding row, column, and page fields to the pivot table report.
 * @typedef {object} PivotTableFieldOptions
 * @property {number | string | number[] | string[]} [rows] - An array of field names or IDs to be added as rows or added to the category axis.
 * @property {number | string | number[] | string[]} [columns] - An array of field names or IDs to be added as columns or added to the series axis.
 * @property {number | string | number[] | string[]} [pages] - An array of field names or IDs to be added as pages or added to the page area.
 * @property {boolean} [addToTable=false] - Specifies whether to apply fields only to the pivot table reports. If `true`, the specified fields will be added to the report 
 * without replacing existing fields. If `false`, existing fields will be replaced with the new fields.
 */

/**
 * Any valid element which can be added to the document structure.
 * @typedef {(ApiParagraph)} DocumentElement
 */

/**
 * The types of elements that can be added to the paragraph structure.
 * @typedef {(ApiUnsupported | ApiRun | ApiHyperlink)} ParagraphContent
 */

/**
 * Class representing a base class for the color types.
 * @constructor
 */
function ApiColor(color) {}

/**
 * Returns a color value in RGB format.
 * @memberof ApiColor
 * @returns {number}
 */
ApiColor.prototype.GetRGB = function () { return 0; };

/**
 * Class representing a name.
 * @constructor
 * @property {string} Name - Sets a name to the active sheet.
 * @property {string} RefersTo - Returns or sets a formula that the name is defined to refer to.
 * @property {ApiRange} RefersToRange - Returns the ApiRange object by reference.
 */
function ApiName(DefName) {}

/**
 * Class representing a comment.
 * @constructor
 * @property {string} Text - Returns or sets the comment text.
 * @property {string} Id - Returns the current comment ID.
 * @property {string} AuthorName - Returns or sets the comment author's name.
 * @property {string} UserId - Returns or sets the user ID of the comment author.
 * @property {boolean} Solved - Checks if a comment is solved or not or marks a comment as solved.
 * @property {number | string} TimeUTC - Returns or sets the timestamp of the comment creation in UTC format.
 * @property {number | string} Time - Returns or sets the timestamp of the comment creation in the current time zone format.
 * @property {string} QuoteText - Returns the quote text of the current comment.
 * @property {Number} RepliesCount - Returns a number of the comment replies.
 */
function ApiComment(comment, wb) {}

/**
 * Class representing a comment reply.
 * @constructor
 * @property {string} Text - Returns or sets the comment reply text.
 * @property {string} AuthorName - Returns or sets the comment reply author's name.
 * @property {string} UserId - Returns or sets the user ID of the comment reply author.
 * @property {number | string} TimeUTC - Returns or sets the timestamp of the comment reply creation in UTC format.
 * @property {number | string} Time - Returns or sets the timestamp of the comment reply creation in the current time zone format.
 */
function ApiCommentReply(oParentComm, oCommentReply) {}

/**
 * Class representing the areas.
 * @constructor
 * @property {number} Count - Returns a value that represents the number of objects in the collection.
 * @property {ApiRange} Parent - Returns the parent object for the specified collection.
 */
function ApiAreas(items, parent) {}

/**
 * Class representing a pivot table.
 * @constructor
 * @property {string} Name - Returns or sets a name of the pivot table.
 * @property {boolean} ColumnGrand - Returns or sets the <b>Grand Totals</b> setting for the pivot table columns.
 * @property {boolean} RowGrand - Returns or sets the <b>Grand Totals</b> setting for the pivot table rows.
 * @property {boolean} DisplayFieldCaptions - Returns or sets the setting which specifies whether to display field headers for rows and columns.
 * @property {string} Title - Returns or sets the pivot table title.
 * @property {string} Description - Returns or sets the pivot table description.
 * @property {string} StyleName - Returns or sets the pivot table style name.
 * @property {ApiWorksheet} Parent - Returns the parent object for the current pivot table.
 * @property {boolean} ShowTableStyleRowHeaders - Returns or sets the setting which specifies whether the row headers of the pivot table will be highlighted with the special formatting.
 * @property {boolean} ShowTableStyleColumnHeaders - Returns or sets the setting which specifies whether the column headers of the pivot table will be highlighted with the special formatting.
 * @property {boolean} ShowTableStyleRowStripes - Returns or sets the setting which specifies whether the background color alternation for odd and even rows will be enabled for the pivot table.
 * @property {boolean} ShowTableStyleColumnStripes - Returns or sets the setting which specifies whether the background color alternation for odd and even columns will be enabled for the pivot table.
 * @property {ApiRange} Source - Returns or sets the source range for the pivot table.
 * @property {ApiRange | null} ColumnRange - Returns a Range object that represents the column area in the pivot table report.
 * @property {ApiRange | null} RowRange - Returns a Range object that represents the row area in the pivot table report.
 * @property {ApiRange} DataBodyRange - Returns a Range object that represents the range of values in the pivot table.
 * @property {ApiRange | null} TableRange1 - Returns a Range object that represents the entire pivot table report, but doesn't include page fields.
 * @property {ApiRange | null} TableRange2 - Returns a Range object that represents the entire pivot table report, including page fields.
 * @property {string} GrandTotalName - Returns or sets the text string label that is displayed in the grand total column or row heading in the specified pivot table report.
 * @property {boolean} RepeatAllLabels - Specifies whether to repeat item labels for all pivot fields in the specified pivot table.
 * @property {object} RowAxisLayout - Sets the way the specified pivot table items appear — in table format or in outline format.
 * @property {boolean} LayoutBlankLine - Sets the setting which specifies whether to insert blank rows after each item in the pivot table.
 * @property {boolean} LayoutSubtotals - Sets the setting which specifies whether to show subtotals in the pivot table.
 * @property {number} SubtotalLocation - Sets the layout subtotal location.
 * @property {ApiPivotField[]} PivotFields - Returns all pivot fields in the pivot table.
 * @property {ApiPivotField[]} ColumnFields - Returns an array that is currently displayed as column fields in the pivot table.
 * @property {ApiPivotField[]} DataFields - Returns an array that is currently displayed as data fields in the pivot table.
 * @property {ApiPivotField[]} HiddenFields - Returns an array that represents all hidden fields in the pivot table.
 * @property {ApiPivotField[]} VisibleFields - Returns an array that represents all visible fields in the pivot table.
 * @property {ApiPivotField[]} PageFields - Returns an array that is currently displayed as page fields in the pivot table.
 * @property {ApiPivotField[]} RowFields - Returns an array that is currently displayed as row fields in the pivot table.
 */
function ApiPivotTable(pivot, api) {}

/** @type {CT_pivotTableDefinition} */

/**
 * Class representing a pivot table field.
 * @constructor
 * @property {number} Position - Returns or sets a value that represents the position of the field (first, second, third, and so on) among all the fields in its orientation (Rows, Columns, Pages, Data).
 * @property {number} Orientation - Returns or sets a pivot field orientation value that represents the location of the field in the specified pivot table report.
 * @property {string} Caption - Returns or sets a value that represents the label text for the pivot field.
 * @property {string} Name - Returns or sets a value representing the object name.
 * @property {string} Value - Returns or sets a value representing the name of the specified field in the pivot table report.
 * @property {string} SourceName - Returns a source name for the pivot table field.
 * @property {number} Index - Returns an index for the pivot table field.
 * @property {ApiPivotTable} Table - Returns the ApiPivotTable object which represents the pivot table for the current field.
 * @property {ApiPivotTable} Parent - Returns the parent object for the current field.
 * @property {boolean} LayoutCompactRow - Returns or sets the setting which specifies whether a pivot table field is compacted.
 * @property {number} LayoutForm - Returns or sets the way the specified pivot table items appear — in table format or in outline format.
 * @property {boolean} LayoutPageBreak - Returns or sets the setting which specifies whether to insert a page break after each field.
 * @property {boolean} ShowingInAxis - Returns the setting which specifies whether the pivot table field is currently visible in the pivot table.
 * @property {boolean} RepeatLabels - Returns or sets the setting which specifies whether to repeat items labels at each row.
 * @property {boolean} LayoutBlankLine - Returns and sets the setting which specifies whether to insert blank rows after each item.
 * @property {boolean} ShowAllItems - Returns or sets the setting which specifies whether to show items with no data.
 * @property {boolean} LayoutSubtotals - Returns or sets the setting which specifies whether to show subtotals.
 * @property {number} LayoutSubtotalLocation - Returns or sets the layout subtotal location.
 * @property {string} SubtotalName - Returns or sets the text label displayed in the subtotal column or row heading in the specified pivot table report.
 * @property {object} Subtotals - Returns or sets the subtotals.
 * @property {number} Formula - Returns or sets a value that represents the object's formula.
 * @property {boolean} DragToColumn - Returns or sets the setting which specifies whether the specified field can be dragged to the column position.
 * @property {boolean} DragToRow - Returns or sets the setting which specifies whether the specified field can be dragged to the row position.
 * @property {boolean} DragToData - Returns or sets the setting which specifies whether the specified field can be dragged to the data position.
 * @property {boolean} DragToPage - Returns or sets the setting which specifies whether the specified field can be dragged to the page position.
 * @property {string | null} NumberFormat - Returns or sets a value that represents the format code for the object.
 * @property {string | number} CurrentPage - Returns the current page which is displayed for the page field (valid only for page fields).
 * @property {ApiPivotItem | ApiPivotItem[]} PivotItems - Returns an object that represents either a single pivot table item (the ApiPivotItem object)
 * or a collection of all the visible and hidden items (an array of the ApiPivotItem objects) in the specified field.
 * @property {string} AutoSortField - Returns the name of the field that is used to sort the specified field.
 * @property {SortOrder} AutoSortOrder - Returns the sort order for the specified field.
 */
function ApiPivotField(table, index, pivotField) {}

/** @type {ApiPivotTable} */

/** @type {number} */

/** @type {CT_PivotField} */

/**
 * Class representing a pivot table data field.
 * @constructor
 * @extends ApiPivotField
 * @property {DataConsolidateFunctionType} Function - Returns or sets a function for the data field.
 * @property {number} Position - Returns or sets a value that represents the data field position within a category.
 * @property {PivotFieldOrientationType} Orientation - Returns a data field orientation value
 * that represents the data field location in the specified pivot table report.
 * @property {string} Name - Returns or sets a value representing the object name.
 * @property {string} Value - Returns or sets a value representing the name of the specified data field in the pivot table report.
 * @property {string} Caption - Returns or sets a value that represents the label text for the data field.
 * @property {string | null} NumberFormat - Returns or sets a value that represents the format code for the object.
 * @property {number} Index - Returns an index of the data field.
 * @property {ApiPivotField} PivotField - Returns the pivot field from which the data field was created.
 */
function ApiPivotDataField(table, dataIndex, dataField) {}

/** @type {number} */

/** @type {CT_DataField} */
ApiPivotDataField.prototype = Object.create(ApiPivotField.prototype);
ApiPivotDataField.prototype.constructor = ApiPivotDataField;{};
ApiPivotDataField.prototype.constructor = ApiPivotDataField;

/**
 * Class representing a pivot table field item.
 * @constructor
 * @property {string} Name - Returns a name of the pivot item.
 * @property {string} Caption - Returns a caption of the pivot item.
 * @property {string} Value - Returns a name of the specified item in the pivot table field.
 * @property {string} Parent - Returns a parent of the pivot item.
 * @property {string} Field - Returns a field of the pivot item.
 * @property {boolean} Visible - Returns or sets a visibility of the pivot item.
 */
function ApiPivotItem(field, item, index) {}

/** @type{ApiPivotField} */

/** @type{CT_Item} */

/** @type{number} */

/**
 * Class representing characters in an object that contains text.
 * @constructor
 * @property {number} Count - The number of characters in the collection.
 * @property {ApiRange} Parent - The parent object of the specified characters.
 * @property {string} Caption - The text of the specified range of characters.
 * @property {string} Text - The string value representing the text of the specified range of characters.
 * @property {ApiFont} Font - The font of the specified characters.
 */
function ApiCharacters(options, parent) {}

/**
 * Class representing a theme.
 * @constructor
 */
function ApiTheme(theme) {}

/**
 * Class that contains the font attributes (font name, font size, color, and so on).
 * @constructor
 * @property {ApiCharacters} Parent - The parent object of the specified font object.
 * @property {boolean | null} Bold - The font bold property.
 * @property {boolean | null} Italic - The font italic property.
 * @property {number | null} Size - The font size property.
 * @property {boolean | null} Strikethrough - The font strikethrough property.
 * @property {string | null} Underline - The font type of underline.
 * @property {boolean | null} Subscript - The font subscript property.
 * @property {boolean | null} Superscript - The font superscript property.
 * @property {string | null} Name - The font name.
 * @property {ApiColor | null} Color - The font color property.
 */
function ApiFont(object) {}

/**
 * Class representing freeze panes.
 * @constructor
 */
function ApiFreezePanes(ws) {}

/**
 * Returns a class formatted according to the instructions contained in the format expression.
 * @memberof ApiInterface
 * @param {string} expression - Any valid expression.
 * @param {string} [format] - A valid named or user-defined format expression.
 * @returns {string}
 */
ApiInterface.prototype.Format = function (expression, format) { return ""; };

/**
 * Creates a new custom function.
 * The description of the function parameters and result is specified using JSDoc. The *@customfunction* tag is required in JSDoc.
 * Parameters and results can be specified as the *number / string / boolean / any / number[][] / string[][] / boolean[][] / any[][]* types.
 * Parameters can be required or optional. A user can also set a default value.
 * The passed function can be asynchronous (async function or function returning a Promise).
 * Inside the passed function, you can access the current cell address where the calculation is performed using *this.address*.
 * You can also access the addresses of function arguments using *this.args[0].address*, *this.args[1].address*, etc.
 * @memberof ApiInterface
 * @param {Function} fCustom - A new function for calculating. Can be synchronous or asynchronous.
 */
ApiInterface.prototype.AddCustomFunction = function (fCustom) {};

/**
 * Registers a new custom functions library (see the <b>SetCustomFunctions</b> plugin method).
 * The description of the function parameters and result is specified using JSDoc. The *@customfunction* tag is required in JSDoc.
 * Parameters and results can be specified as the *number / string / boolean / any / number[][] / string[][] / boolean[][] / any[][]* types.
 * Parameters can be required or optional. A user can also set a default value.
 * @memberof ApiInterface
 * @param {string} sName - The library name.
 * @param {Function} Func - The custom functions library code.
 * @since 8.2.0
 */
ApiInterface.prototype.AddCustomFunctionLibrary = function(sName, Func) {};

/**
 * Removes a custom function.
 * @memberof ApiInterface
 * @param {string} sName - The name of a custom function.
 * @returns {boolean} - returns false if such a function does not exist.
 */
ApiInterface.prototype.RemoveCustomFunction = function (sName) { return true; };

/**
 * Clears all custom functions.
 * @memberof ApiInterface
 * @returns {boolean} - returns false if such functions do not exist.
 */
ApiInterface.prototype.ClearCustomFunctions = function () { return true; };

/**
 * Creates a new worksheet. The new worksheet becomes the active sheet.
 * @memberof ApiInterface
 * @param {string} sName - The name of a new worksheet.
 */
ApiInterface.prototype.AddSheet = function (sName) {};

/**
 * Returns a sheet collection that represents all the sheets in the active workbook.
 * @memberof ApiInterface
 * @returns {ApiWorksheet[]}
 */
ApiInterface.prototype.GetSheets = function () { return [new ApiWorksheet()]; };

/**
 * Returns a sheet collection that represents all the sheets in the active workbook.
 * @memberof ApiInterface
 * @returns {ApiWorksheet[]}
 */
ApiInterface.prototype.Sheets = ApiInterface.prototype.GetSheets ();

/**
 * Sets a locale to the document.
 * @memberof ApiInterface
 * @param {number} LCID - The locale specified.
 */
ApiInterface.prototype.SetLocale = function (LCID) {};

/**
 * Returns the current locale ID.
 * @memberof ApiInterface
 * @returns {number}
 */
ApiInterface.prototype.GetLocale = function () { return 0; };

/**
 * Returns an object that represents the active sheet.
 * @memberof ApiInterface
 * @returns {ApiWorksheet}
 */
ApiInterface.prototype.GetActiveSheet = function () { return new ApiWorksheet(); };

/**
 * Returns an object that represents the active sheet.
 * @memberof ApiInterface
 * @returns {ApiWorksheet}
 */
ApiInterface.prototype.ActiveSheet = ApiInterface.prototype.GetActiveSheet ();

/**
 * Returns an object that represents the active workbook.
 * @memberof ApiInterface
 * @returns {ApiWorkbook}
 */
ApiInterface.prototype.GetActiveWorkbook = function () { return new ApiWorkbook(); };

/**
 * Returns an object that represents the active workbook.
 * @memberof ApiInterface
 * @returns {ApiWorkbook}
 */
ApiInterface.prototype.ActiveWorkbook = ApiInterface.prototype.GetActiveWorkbook ();

/**
 * Returns an object that represents a sheet.
 * @memberof ApiInterface
 * @param {string | number} nameOrIndex - Sheet name or sheet index.
 * @returns {ApiWorksheet | null}
 */
ApiInterface.prototype.GetSheet = function (nameOrIndex) { return new ApiWorksheet(); };

/**
 * Returns a list of all the available theme colors for the spreadsheet.
 * @memberof ApiInterface
 * @returns {string[]}
 */
ApiInterface.prototype.GetThemesColors = function () { return [""]; };

/**
 * Sets the theme colors to the current spreadsheet.
 * @memberof ApiInterface
 * @param {string} sTheme - The color scheme that will be set to the current spreadsheet.
 * @returns {boolean} - returns false if sTheme isn't a string.
 */
ApiInterface.prototype.SetThemeColors = function (sTheme) { return true; };

/**
 * Creates a new history point.
 * @memberof ApiInterface
 */
ApiInterface.prototype.CreateNewHistoryPoint = function () {};

/**
 * Creates an RGB color setting the appropriate values for the red, green and blue color components.
 * @memberof ApiInterface
 * @param {byte} r - Red color component value.
 * @param {byte} g - Green color component value.
 * @param {byte} b - Blue color component value.
 * @returns {ApiColor}
 */
ApiInterface.prototype.CreateColorFromRGB = function (r, g, b) { return new ApiColor(); };

/**
 * Creates a color selecting it from one of the available color presets.
 * @memberof ApiInterface
 * @param {PresetColor} sPresetColor - A preset selected from the list of the available color preset names.
 * @returns {ApiColor}
 */
ApiInterface.prototype.CreateColorByName = function (sPresetColor) { return new ApiColor(); };

/**
 * Returns the ApiRange object that represents the rectangular intersection of two or more ranges. If one or more ranges from a different worksheet are specified, an error will be returned.
 * @memberof ApiInterface
 * @param {ApiRange} Range1 - One of the intersecting ranges. At least two Range objects must be specified.
 * @param {ApiRange} Range2 - One of the intersecting ranges. At least two Range objects must be specified.
 * @returns {ApiRange | null}
 */
ApiInterface.prototype.Intersect = function (Range1, Range2) { return new ApiRange(); };

/**
 * Returns an object that represents the selected range.
 * @memberof ApiInterface
 * @returns {ApiRange}
 */
ApiInterface.prototype.GetSelection = function () { return new ApiRange(); };

/**
 * Returns an object that represents the selected range.
 * @memberof ApiInterface
 * @returns {ApiRange}
 */
ApiInterface.prototype.Selection = ApiInterface.prototype.GetSelection ();

/**
 * Adds a new name to a range of cells.
 * @memberof ApiInterface
 * @param {string} sName - The range name.
 * @param {string} sRef - The reference to the specified range. It must contain the sheet name, followed by sign ! and a range of cells.
 * Example: "Sheet1!$A$1:$B$2".
 * @param {boolean} isHidden - Defines if the range name is hidden or not.
 * @returns {boolean} - returns false if sName or sRef are invalid.
 */
ApiInterface.prototype.AddDefName = function (sName, sRef, isHidden) { return true; };

/**
 * Returns the ApiName object by the range name.
 * @memberof ApiInterface
 * @param {string} defName - The range name.
 * @returns {ApiName}
 */
ApiInterface.prototype.GetDefName = function (defName) { return new ApiName(); };

/**
 * Saves changes to the specified document.
 * @memberof ApiInterface
 */
ApiInterface.prototype.Save = function () {};

/**
 * Returns the ApiRange object by the range reference.
 * @memberof ApiInterface
 * @param {string} sRange - The range of cells from the current sheet.
 * @returns {ApiRange}
 */
ApiInterface.prototype.GetRange = function (sRange) { return new ApiRange(); };

/**
 * Returns the ApiWorksheetFunction object.
 * @memberof ApiInterface
 * @returns {ApiWorksheetFunction}
 */
ApiInterface.prototype.GetWorksheetFunction = function () { return new ApiWorksheetFunction(); };

/**
 * Returns the ApiWorksheetFunction object.
 * @memberof ApiInterface
 * @returns {ApiWorksheetFunction}
 */
ApiInterface.prototype.WorksheetFunction = ApiInterface.prototype.GetWorksheetFunction ();

/**
 * Class representing a worksheet function.
 * @constructor
 */
function ApiWorksheetFunction(api) {}

// + "\t * @returns {number | string | boolean}\n" + "\t */
\n" + "\tApiWorksheetFunction.prototype." + i.replaceAll(".","_")  + "= function (" + test2 + ") \n" + "\t\treturn this.private_calculateFunction(\"" + i + "\", arguments);\n" + "\t;"{ return 0; };

/**
 * For double-byte character set (DBCS) languages, the function changes full-width (double-byte) characters to half-width (single-byte) characters.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | string} arg1 - The text or a reference to a cell containing the text to change.
 * @returns {string}
 */
ApiWorksheetFunction.prototype.ASC = function (arg1) { return ""; };

/**
 * Returns the character specified by the code number from your computer's character set.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - A number between 1 and 255 specifying a character from the computer character set.
 * @returns {string}
 */
ApiWorksheetFunction.prototype.CHAR = function (arg1) { return ""; };

/**
 * Removes all the nonprintable characters from the text.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | string} arg1 - A string from which nonprintable characters will be removed.
 * @returns {string}
 */
ApiWorksheetFunction.prototype.CLEAN = function (arg1) { return ""; };

/**
 * Returns the code number from your computer's character set for the first character in the specified text string.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | string} arg1 - The text for which to get the code of the first character.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.CODE = function (arg1) { return 0; };

/**
 * Combines multiple text strings into one text string.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | string} arg_n - Up to 255 data values that will be combined.
 * @returns {string}
 */
ApiWorksheetFunction.prototype.CONCATENATE = function () { return ""; };

/**
 * Converts a number to text, using a currency format $#.##.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number | string} arg1 - A number, a reference to a cell containing a number, or a formula that returns a number.
 * @param {ApiRange | ApiName | number} [arg2] - A number of digits to the right of the decimal point. The number is rounded as necessary.
 * If it is omitted, the function will assume it to be 2.
 * @returns {string}
 */
ApiWorksheetFunction.prototype.DOLLAR = function (arg1, arg2) { return ""; };

/**
 * Checks whether two text strings are exactly the same, and returns <b>true</b> or <b>false</b>. This function is case-sensitive.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | string} arg1 - The first text string.
 * @param {ApiRange | ApiName | string} arg2 - The second text string.
 * @returns {boolean}
 */
ApiWorksheetFunction.prototype.EXACT = function (arg1, arg2) { return true; };

/**
 * Returns the starting position of one text string within another text string. This function is case-sensitive.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | string} arg1 - The text to find. Use double quotes (empty text) to match the first character in the search string.
 * Wildcard characters are not allowed.
 * @param {ApiRange | ApiName | string} arg2 - The text containing the text to find.
 * @param {ApiRange | ApiName | number} [arg3] - Specifies the character at which to start the search. The first character in the search string is character number 1.
 * If omitted, this parameter is equal to 1.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.FIND = function (arg1, arg2, arg3) { return 0; };

/**
 * Finds the specified substring within another string and is intended for languages that use the double-byte character set (DBCS) like Japanese, Chinese, Korean etc.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | string} arg1 - The text to find. Use double quotes (empty text) to match the first character in the search string.
 * Wildcard characters are not allowed.
 * @param {ApiRange | ApiName | string} arg2 - The text containing the text to find.
 * @param {ApiRange | ApiName | number} [arg3] - Specifies the character at which to start the search. The first character in the search string is character number 1.
 * If omitted, this parameter is equal to 1.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.FINDB = function (arg1, arg2, arg3) { return 0; };

/**
 * Rounds a number to the specified number of decimals and returns the result as text with or without commas.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The number to round and convert to text.
 * @param {ApiRange | ApiName | number} [arg2] - The number of digits to the right of the decimal point. If omitted, the function will assume it to be 2.
 * @param {ApiRange | ApiName | boolean} [arg3] - Specifies whether do display commas in the returned text (<b>false</b> or omitted) or not (<b>true</b>).
 * @returns {string}
 */
ApiWorksheetFunction.prototype.FIXED = function (arg1, arg2, arg3) { return ""; };

/**
 * Returns the specified number of characters from the start of a text string.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | string} arg1 - The text string containing the characters to extract.
 * @param {ApiRange | ApiName | number} [arg2] - A number of the substring characters. It must be greater than or equal to 0.
 * @returns {string}
 */
ApiWorksheetFunction.prototype.LEFT = function (arg1, arg2) { return ""; };

/**
 * Extracts the substring from the specified string starting from the left character and is intended for languages that use the double-byte character set (DBCS) like Japanese, Chinese, Korean etc.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | string} arg1 - The text string containing the characters to extract.
 * @param {ApiRange | ApiName | number} [arg2] - A number of the substring characters, based on bytes.
 * @returns {string}
 */
ApiWorksheetFunction.prototype.LEFTB = function (arg1, arg2) { return ""; };

/**
 * Returns the number of characters in a text string.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | string} arg1 - The text whose length will be returned. Spaces are considered as characters.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.LEN = function (arg1) { return 0; };

/**
 * Analyses the specified string and returns the number of characters it contains and is intended for languages that use the double-byte character set (DBCS) like Japanese, Chinese, Korean etc.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | string} arg1 - The text whose length will be returned. Spaces are considered as characters.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.LENB = function (arg1) { return 0; };

/**
 * Converts all letters in a text string to lowercase.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | string} arg1 - The text to convert to lowercase. The text characters that are not letters are not changed.
 * @returns {string}
 */
ApiWorksheetFunction.prototype.LOWER = function (arg1) { return ""; };

/**
 * Returns the characters from the middle of a text string, given a starting position and length.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | string} arg1 - The text string from which to extract the characters.
 * @param {ApiRange | ApiName | number} arg2 - The position of the first character to extract. The first text character is 1.
 * @param {ApiRange | ApiName | number} arg3 - A number of the characters to extract.
 * @returns {string}
 */
ApiWorksheetFunction.prototype.MID = function (arg1, arg2, arg3) { return ""; };

/**
 * Extracts the characters from the specified string starting from any position and is intended for languages that use the double-byte character set (DBCS) like Japanese, Chinese, Korean etc.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | string} arg1 - The text string from which to extract the characters.
 * @param {ApiRange | ApiName | number} arg2 - The position of the first character to extract. The first text character is 1.
 * @param {ApiRange | ApiName | number} arg3 - A number of the characters to extract, based on bytes.
 * @returns {string}
 */
ApiWorksheetFunction.prototype.MIDB = function (arg1, arg2, arg3) { return ""; };

/**
 * Converts text to a number, in a locale-independent way.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | string} arg1 - The string representing a number to convert.
 * @param {ApiRange | ApiName | string} [arg2] - The character used as the decimal separator in the string.
 * @param {ApiRange | ApiName | string} [arg3] - The character used as the group separator in the string.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.NUMBERVALUE = function (arg1, arg2, arg3) { return 0; };

/**
 * Converts a text string to proper case: the first letter in each word to uppercase, and all other letters to lowercase.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | string} arg1 - The text enclosed in quotation marks, a formula that returns text, or a reference to a cell containing text to partially capitalize.
 * @returns {string}
 */
ApiWorksheetFunction.prototype.PROPER = function (arg1) { return ""; };

/**
 * Replaces part of a text string with a different text string.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | string} arg1 - The text where some characters will be replaced.
 * @param {ApiRange | ApiName | number} arg2 - The position of the character in the original text that will be replaced with the new text.
 * @param {ApiRange | ApiName | number} arg3 - The number of characters in the original text that will be replaced.
 * @param {ApiRange | ApiName | string} arg4 - The text that will replace characters in the original text.
 * @returns {string}
 */
ApiWorksheetFunction.prototype.REPLACE = function (arg1, arg2, arg3, arg4) { return ""; };

/**
 * Replaces a set of characters, based on the number of characters and the start position specified, with a new set of characters and is intended for languages that use the double-byte character set (DBCS) like Japanese, Chinese, Korean etc.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | string} arg1 - The text where some characters will be replaced.
 * @param {ApiRange | ApiName | number} arg2 - The position of the character in the original text that will be replaced with the new text.
 * @param {ApiRange | ApiName | number} arg3 - The number of characters in the original text that will be replaced, based on bytes.
 * @param {ApiRange | ApiName | string} arg4 - The text that will replace characters in the original text.
 * @returns {string}
 */
ApiWorksheetFunction.prototype.REPLACEB = function (arg1, arg2, arg3, arg4) { return ""; };

/**
 * Repeats text a given number of times. Use this function to fill a cell with a number of instances of a text string.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | string} arg1 - The text that will be repeated.
 * @param {ApiRange | ApiName | number} arg2 - A positive number specifying the number of times to repeat text.
 * @returns {string}
 */
ApiWorksheetFunction.prototype.REPT = function (arg1, arg2) { return ""; };

/**
 * Returns the specified number of characters from the end of a text string.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | string} arg1 - The text string that contains the characters to extract.
 * @param {ApiRange | ApiName | number} [arg2] - A number of the substring characters. If it is omitted, the function will assume it to be 1.
 * @returns {string}
 */
ApiWorksheetFunction.prototype.RIGHT = function (arg1, arg2) { return ""; };

/**
 * Extracts a substring from a string starting from the right-most character, based on the specified number of characters and is intended for languages that use the double-byte character set (DBCS) like Japanese, Chinese, Korean etc.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | string} arg1 - The text string that contains the characters to extract.
 * @param {ApiRange | ApiName | number} [arg2] - A number of the substring characters, based on bytes.
 * @returns {string}
 */
ApiWorksheetFunction.prototype.RIGHTB = function (arg1, arg2) { return ""; };

/**
 * Returns the number of the character at which a specific character or text string is first found, reading left to right (not case-sensitive).
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | string} arg1 - The text to find. The ? and * wildcard characters can be used. Use ~? and ~* to find the ? and * characters.
 * @param {ApiRange | ApiName | string} arg2 - The text where to search for the specified text.
 * @param {ApiRange | ApiName | number} [arg3] - The character number in the search text, counting from the left, at which to start searching. If omitted, 1 is used.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.SEARCH = function (arg1, arg2, arg3) { return 0; };

/**
 * Returns the location of the specified substring in a string and is intended for languages that use the double-byte character set (DBCS) like Japanese, Chinese, Korean etc.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | string} arg1 - The text to find. The ? and * wildcard characters can be used. Use ~? and ~* to find the ? and * characters.
 * @param {ApiRange | ApiName | string} arg2 - The text where to search for the specified text.
 * @param {ApiRange | ApiName | number} [arg3] - The character number in the search text, counting from the left, at which to start searching. If omitted, 1 is used.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.SEARCHB = function (arg1, arg2, arg3) { return 0; };

/**
 * Replaces existing text with new text in a text string.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | string} arg1 - The text or the reference to a cell containing text in which the characters will be substituted.
 * @param {ApiRange | ApiName | string} arg2 - The existing text to replace. If the case of the original text does not match the case of text, the function will not replace the text.
 * @param {ApiRange | ApiName | string} arg3 - The text to replace the original text with.
 * @param {ApiRange | ApiName | string} [arg4] - Specifies which occurrence of the original text to replace. If omitted, every instance of the original text will be replaced.
 * @returns {string}
 */
ApiWorksheetFunction.prototype.SUBSTITUTE = function (arg1, arg2, arg3, arg4) { return ""; };

/**
 * Checks whether a value is text, and returns the text if it is, or returns double quotes (empty text) if it is not.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number | string | boolean} arg1 - The value to test.
 * @returns {ApiRange | ApiName | string}
 */
ApiWorksheetFunction.prototype.T = function (arg1) { return new ApiRange(); };

/**
 * Converts a value to text in a specific number format.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number | string} arg1 - A number, a formula that evaluates to a numeric value, or a reference to a cell containing a numeric value.
 * @param {ApiRange | ApiName | string} arg2 - A number format in the text form from the <b>Number format</b> combo box on the <b>Home</b> tab.
 * @returns {string}
 */
ApiWorksheetFunction.prototype.TEXT = function (arg1, arg2) { return ""; };

/**
 * Removes all spaces from a text string except for single spaces between words.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | string} arg1 - The text from which the spaces will be removed.
 * @returns {string}
 */
ApiWorksheetFunction.prototype.TRIM = function (arg1) { return ""; };

/**
 * Returns the Unicode character referenced by the given numeric value.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The Unicode number representing a character.
 * @returns {string}
 */
ApiWorksheetFunction.prototype.UNICHAR = function (arg1) { return ""; };

/**
 * Returns the number (code point) corresponding to the first character of the text.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | string} arg1 - The character for which the Unicode value will be returned.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.UNICODE = function (arg1) { return 0; };

/**
 * Converts a text string to all uppercase letters.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | string} arg1 - The text which will be converted to uppercase, a reference or a text string.
 * @returns {string}
 */
ApiWorksheetFunction.prototype.UPPER = function (arg1) { return ""; };

/**
 * Converts a text string that represents a number to a number.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | string} arg1 - The text enclosed in quotation marks or a reference to a cell containing the text which will be converted to a number.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.VALUE = function (arg1) { return 0; };

/**
 * Returns the average of the absolute deviations of data points from their mean.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number | number[]} args - Up to 255 numeric values for which the average of the absolute deviations will be returned. The first argument is required,
 * subsequent arguments are optional. Arguments can be numbers, names, or arrays of numbers.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.AVEDEV = function () { return 0; };

/**
 * Returns the average (arithmetic mean) of the specified arguments.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number | number[]} args - Up to 255 numeric values for which the average value will be returned. The first argument is required,
 * subsequent arguments are optional. Arguments can be numbers, names, or arrays of numbers.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.AVERAGE = function () { return 0; };

/**
 * Returns the average (arithmetic mean) of the specified arguments, evaluating text and <b>false</b> in arguments as 0; <b>true</b> evaluates as 1.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number | string | number[]} args - Up to 255 numeric values for which the average value will be returned. The first argument is required,
 * subsequent arguments are optional. Arguments can be numbers, text, or logical values, such as <b>true</b> and <b>false</b>, names, or arrays of numbers.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.AVERAGEA = function () { return 0; };

/**
 * Finds the average (arithmetic mean) for the cells specified by a given condition or criteria.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName} arg1 - The range of cells which will be evaluated.
 * @param {ApiRange | ApiName | number | string} arg2 - The condition or criteria in the form of a number, expression, or text that defines which cells will be used to find the average.
 * @param {ApiRange | ApiName} [arg3] - The actual cells to be used to find the average. If omitted, the cells in the range are used.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.AVERAGEIF = function (arg1, arg2, arg3) { return 0; };

/**
 * Finds the average (arithmetic mean) for the cells specified by a given set of conditions or criteria.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName} arg1 - The range of cells which will be evaluated.
 * @param {ApiRange | ApiName | number | string} arg2 - The first condition or criteria in the form of a number, expression, or text that defines which cells will be used to find the average.
 * @param {ApiRange | ApiName} [arg3] - The actual cells to be used to find the average. If omitted, the cells in the range are used.
 * @param {ApiRange | ApiName | number | string} [arg4] - Up to 127 additional conditions or criteria in the form of a number, expression, or text that defines which cells will be used to find the average.
 * These arguments are optional.
 * @param {ApiRange | ApiName} [arg5] - Up to 127 actual ranges to be used to find the average. If omitted, the cells in the range are used. These arguments are optional.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.AVERAGEIFS = function () { return 0; };

/**
 * Returns the cumulative beta probability density function.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The value between A and B at which to evaluate the function.
 * @param {ApiRange | ApiName | number} arg2 - The alpha parameter of the distribution which must be greater than 0.
 * @param {ApiRange | ApiName | number} arg3 - The beta parameter of the distribution which must be greater than 0.
 * @param {ApiRange | ApiName | number} [arg4] - An optional lower bound to the interval of x (A). If omitted, it is equal to 0.
 * @param {ApiRange | ApiName | number} [arg5] - An optional upper bound to the interval of x (B). If omitted, it is equal to 1.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.BETADIST = function (arg1, arg2, arg3, arg4, arg5) { return 0; };

/**
 * Returns the beta probability distribution function.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The value between A and B at which to evaluate the function.
 * @param {ApiRange | ApiName | number} arg2 - The alpha parameter of the distribution which must be greater than 0.
 * @param {ApiRange | ApiName | number} arg3 - The beta parameter of the distribution which must be greater than 0.
 * @param {ApiRange | ApiName | boolean} arg4 - Specifies if this is the cumulative distribution function (<b>true</b>) or the probability density function (<b>false</b>).
 * @param {ApiRange | ApiName | number} [arg5] - An optional lower bound to the interval of x (A). If omitted, it is equal to 0.
 * @param {ApiRange | ApiName | number} [arg6] - An optional upper bound to the interval of x (B). If omitted, it is equal to 1.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.BETA_DIST = function (arg1, arg2, arg3, arg4, arg5, arg6) { return 0; };

/**
 * Returns the inverse of the cumulative beta probability density function (BETA_DIST).
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - A probability associated with the beta distribution.
 * @param {ApiRange | ApiName | number} arg2 - The alpha parameter of the distribution which must be greater than 0.
 * @param {ApiRange | ApiName | number} arg3 - The beta parameter of the distribution which must be greater than 0.
 * @param {ApiRange | ApiName | number} [arg4] - An optional lower bound to the interval of x (A). If omitted, it is equal to 0.
 * @param {ApiRange | ApiName | number} [arg5] - An optional upper bound to the interval of x (B). If omitted, it is equal to 1.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.BETA_INV = function (arg1, arg2, arg3, arg4, arg5) { return 0; };

/**
 * Returns the inverse of the cumulative beta probability density function for a specified beta distribution (BETADIST).
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - A probability associated with the beta distribution.
 * @param {ApiRange | ApiName | number} arg2 - The alpha parameter of the distribution which must be greater than 0.
 * @param {ApiRange | ApiName | number} arg3 - The beta parameter of the distribution which must be greater than 0.
 * @param {ApiRange | ApiName | number} [arg4] - An optional lower bound to the interval of x (A). If omitted, it is equal to 0.
 * @param {ApiRange | ApiName | number} [arg5] - An optional upper bound to the interval of x (B). If omitted, it is equal to 1.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.BETAINV = function (arg1, arg2, arg3, arg4, arg5) { return 0; };

/**
 * Returns the individual term binomial distribution probability.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The number of successes in trials.
 * @param {ApiRange | ApiName | number} arg2 - The number of independent trials.
 * @param {ApiRange | ApiName | number} arg3 - The probability of success on each trial.
 * @param {ApiRange | ApiName | boolean} arg4 - Specifies if this is the cumulative distribution function (<b>true</b>) or the probability mass function (<b>false</b>).
 * @returns {number}
 */
ApiWorksheetFunction.prototype.BINOMDIST = function (arg1, arg2, arg3, arg4) { return 0; };

/**
 * Returns the individual term binomial distribution probability.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The number of successes in trials.
 * @param {ApiRange | ApiName | number} arg2 - The number of independent trials.
 * @param {ApiRange | ApiName | number} arg3 - The probability of success on each trial.
 * @param {ApiRange | ApiName | boolean} arg4 - Specifies if this is the cumulative distribution function (<b>true</b>) or the probability mass function (<b>false</b>).
 * @returns {number}
 */
ApiWorksheetFunction.prototype.BINOM_DIST = function (arg1, arg2, arg3, arg4) { return 0; };

/**
 * Returns the probability of a trial result using a binomial distribution.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The number of independent trials.
 * @param {ApiRange | ApiName | number} arg2 - The probability of success on each trial.
 * @param {ApiRange | ApiName | number} arg3 - The minimum number of successes in the trials to calculate probability for, a numeric value greater than or equal to 0.
 * @param {ApiRange | ApiName | number} [arg4] - The maximum number of successes in the trials to calculate probability for,
 * a numeric value greater than the minimum number of successes and less than or equal to trials.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.BINOM_DIST_RANGE = function (arg1, arg2, arg3, arg4) { return 0; };

/**
 * Returns the smallest value for which the cumulative binomial distribution is greater than or equal to a criterion value.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The number of Bernoulli trials.
 * @param {ApiRange | ApiName | number} arg2 - The probability of success on each trial, a number between 0 and 1 inclusive.
 * @param {ApiRange | ApiName | number} arg3 - The criterion value, a number between 0 and 1 inclusive.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.BINOM_INV = function (arg1, arg2, arg3) { return 0; };

/**
 * Returns the right-tailed probability of the chi-squared distribution.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The value at which the distribution will be evaluated, a nonnegative number.
 * @param {ApiRange | ApiName | number} arg2 - The number of degrees of freedom, a number between 1 and 10^10, excluding 10^10.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.CHIDIST = function (arg1, arg2) { return 0; };

/**
 * Returns the inverse of the right-tailed probability of the chi-squared distribution.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - A probability associated with the chi-squared distribution, a value between 0 and 1 inclusive.
 * @param {ApiRange | ApiName | number} arg2 - The number of degrees of freedom, a number between 1 and 10^10, excluding 10^10.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.CHIINV = function (arg1, arg2) { return 0; };

/**
 * Returns the left-tailed probability of the chi-squared distribution.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The value at which the distribution will be evaluated, a nonnegative number.
 * @param {ApiRange | ApiName | number} arg2 - The number of degrees of freedom, a number between 1 and 10^10, excluding 10^10.
 * @param {ApiRange | ApiName | boolean} arg3 - A logical value that determines the form of the function. If this argument is equal to <b>true</b>,
 * the cumulative distribution function is returned; if  it is equal to <b>false</b>, the probability density function is returned.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.CHISQ_DIST = function (arg1, arg2, arg3) { return 0; };

/**
 * Returns the right-tailed probability of the chi-squared distribution.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The value at which the distribution will be evaluated, a nonnegative number.
 * @param {ApiRange | ApiName | number} arg2 - The number of degrees of freedom, a number between 1 and 10^10, excluding 10^10.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.CHISQ_DIST_RT = function (arg1, arg2) { return 0; };

/**
 * Returns the inverse of the left-tailed probability of the chi-squared distribution.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - A probability associated with the chi-squared distribution, a value between 0 and 1 inclusive.
 * @param {ApiRange | ApiName | number} arg2- The number of degrees of freedom, a number between 1 and 10^10, excluding 10^10.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.CHISQ_INV = function (arg1, arg2) { return 0; };

/**
 * Returns the inverse of the right-tailed probability of the chi-squared distribution.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - A probability associated with the chi-squared distribution, a value between 0 and 1 inclusive.
 * @param {ApiRange | ApiName | number} arg2 - The number of degrees of freedom, a number between 1 and 10^10, excluding 10^10.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.CHISQ_INV_RT = function (arg1, arg2) { return 0; };

/**
//  * Returns the result of calculating the function.
//  * @memberof ApiWorksheetFunction
//  * @param {any} arg1.
//  * @param {any} arg2.
//  * @returns {number | string | boolean}
//  */
// ApiWorksheetFunction.prototype.CHITEST = function (arg1, arg2) { return 0; };

/**
 * Returns the test for independence: the value from the chi-squared distribution for the statistic and the appropriate degrees of freedom.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number | string | boolean} arg1 - The range of data that contains observations to test against expected values.
 * @param {ApiRange | ApiName | number | string | boolean} arg2 - The range of data that contains the ratio of the product of row totals and column totals to the grand total.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.CHITEST = function (arg1, arg2) { return 0; };

/**
//  * Returns the test for independence: the value from the chi-squared distribution for the statistic and the appropriate degrees of freedom.
//  * @memberof ApiWorksheetFunction
//  * @param {any} arg1 Is the range of data that contains observations to test against expected values.
//  * @param {any} arg2 Is the range of data that contains the ratio of the product of row totals and column totals to the grand total.
//  * @returns {number | string | boolean}
//  */
// ApiWorksheetFunction.prototype.CHISQ_TEST = function (arg1, arg2) { return 0; };

/**
 * Returns the confidence interval for a population mean, using a normal distribution.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The significance level used to compute the confidence level, a number greater than 0 and less than 1.
 * @param {ApiRange | ApiName | number} arg2 - The population standard deviation for the data range and is assumed to be known. This value must be greater than 0.
 * @param {ApiRange | ApiName | number} arg3 - The sample size.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.CONFIDENCE = function (arg1, arg2, arg3) { return 0; };

/**
 * Returns the confidence interval for a population mean, using a normal distribution.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The significance level used to compute the confidence level, a number greater than 0 and less than 1.
 * @param {ApiRange | ApiName | number} arg2 - The population standard deviation for the data range and is assumed to be known. This value must be greater than 0.
 * @param {ApiRange | ApiName | number} arg3 - The sample size.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.CONFIDENCE_NORM = function (arg1, arg2, arg3) { return 0; };

/**
 * Returns the confidence interval for a population mean, using a Student's t distribution.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The significance level used to compute the confidence level, a number greater than 0 and less than 1.
 * @param {ApiRange | ApiName | number} arg2 - The population standard deviation for the data range and is assumed to be known. This value must be greater than 0.
 * @param {ApiRange | ApiName | number} arg3 - The sample size.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.CONFIDENCE_T = function (arg1, arg2, arg3) { return 0; };

/**
//  * Returns the correlation coefficient between two data sets.
//  * @memberof ApiWorksheetFunction
//  * @param {any} arg1 Is a cell range of values. The values should be numbers, names, arrays, or references that contain numbers.
//  * @param {any} arg2 Is a second cell range of values. The values should be numbers, names, arrays, or references that contain numbers.
//  * @returns {number | string | boolean}
//  */
// ApiWorksheetFunction.prototype.CORREL = function (arg1, arg2) { return 0; };

/**
 * Counts a number of cells in a range that contains numbers ignoring empty cells or those contaning text.
 * @memberof ApiWorksheetFunction
 * @param {string | number | boolean | Array<string | number | boolean> | ApiRange | ApiName} args - Up to 255 items, or ranges to count numbers.
 * The first argument is required, subsequent arguments are optional. Arguments can be numbers, logical values and text representations of numbers, ranges, names, or arrays.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.COUNT = function () { return 0; };

/**
 * Counts a number of cells in a range that are not empty.
 * @memberof ApiWorksheetFunction
 * @param {string | number | boolean | Array<string | number | boolean> | ApiRange | ApiName} args - Up to 255 items, or ranges to count values.
 * The first argument is required, subsequent arguments are optional. Arguments can be numbers, logical values, text strings, ranges, names, or arrays.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.COUNTA = function () { return 0; };

/**
 * Counts a number of empty cells in a specified range of cells.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName} arg1 - The range to count the empty cells.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.COUNTBLANK = function (arg1) { return 0; };

/**
 * Counts a number of cells within a range that meet the given condition.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName} arg1 - The range of cells to count nonblank cells.
 * @param {ApiRange | ApiName | number | string} arg2 - The condition in the form of a number, expression, or text that defines which cells will be counted.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.COUNTIF = function (arg1, arg2) { return 0; };

/**
 * Counts a number of cells specified by a given set of conditions or criteria.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName} arg1 - The first range of cells to count nonblank cells.
 * @param {ApiRange | ApiName | number | string} arg2 - The first condition in the form of a number, expression, or text that defines which cells will be counted.
 * @param {ApiRange | ApiName} arg3 - Up to 127 additional ranges of cells to count nonblank cells. This argument is optional.
 * @param {ApiRange | ApiName | number | string} arg4 - Up to 127 additional conditions in the form of a number, expression, or text that define which cells will be counted.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.COUNTIFS = function () { return 0; };

/**
//  * Returns covariance, the average of the products of deviations for each data point pair in two data sets.
//  * @memberof ApiWorksheetFunction
//  * @param {any} arg1 Is the first cell range of integers and must be numbers, arrays, or references that contain numbers.
//  * @param {any} arg2 Is the second cell range of integers and must be numbers, arrays, or references that contain numbers.
//  * @returns {number | string | boolean}
//  */
// ApiWorksheetFunction.prototype.COVAR = function (arg1, arg2) { return 0; };

/**
//  * Returns population covariance, the average of the products of deviations for each data point pair in two data sets.
//  * @memberof ApiWorksheetFunction
//  * @param {any} arg1 Is the first cell range of integers and must be numbers, arrays, or references that contain numbers.
//  * @param {any} arg2 Is the second cell range of integers and must be numbers, arrays, or references that contain numbers.
//  * @returns {number | string | boolean}
//  */
// ApiWorksheetFunction.prototype.COVARIANCE_P = function (arg1, arg2) { return 0; };

/**
//  * Returns sample covariance, the average of the products of deviations for each data point pair in two data sets.
//  * @memberof ApiWorksheetFunction
//  * @param {any} arg1 Is the first cell range of integers and must be numbers, arrays, or references that contain numbers.
//  * @param {any} arg2 Is the second cell range of integers and must be numbers, arrays, or references that contain numbers.
//  * @returns {number | string | boolean}
//  */
// ApiWorksheetFunction.prototype.COVARIANCE_S = function (arg1, arg2) { return 0; };

/**
 * Returns the smallest value for which the cumulative binomial distribution is greater than or equal to a criterion value.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The number of Bernoulli trials.
 * @param {ApiRange | ApiName | number} arg2 - The probability of success on each trial, a number between 0 and 1 inclusive.
 * @param {ApiRange | ApiName | number} arg3 - The criterion value, a number between 0 and 1 inclusive.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.CRITBINOM = function (arg1, arg2, arg3) { return 0; };

/**
 * Returns the sum of squares of deviations of data points from their sample mean.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number | number[]} args - Up to 255 numerical values for which to find the sum of squares of deviations.
 * The first argument is required, subsequent arguments are optional. Arguments can be numbers, names, or arrays of numbers.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.DEVSQ = function () { return 0; };

/**
 * Returns the exponential distribution.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The value of the x function, a nonnegative number.
 * @param {ApiRange | ApiName | number} arg2 - The lambda parameter value, a positive number.
 * @param {ApiRange | ApiName | boolean} arg3 - A logical value that determines the function form. If this parameter is <b>true</b>,
 * the function will return the cumulative distribution function, if it is <b>false</b>, it will return the probability density function.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.EXPON_DIST = function (arg1, arg2, arg3) { return 0; };

/**
 * Returns the exponential distribution.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The value of the x function, a nonnegative number.
 * @param {ApiRange | ApiName | number} arg2 - The lambda parameter value, a positive number.
 * @param {ApiRange | ApiName | boolean} arg3 - A logical value that determines the function form. If this parameter is <b>true</b>,
 * the function will return the cumulative distribution function, if it is <b>false</b>, it will return the probability density function.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.EXPONDIST = function (arg1, arg2, arg3) { return 0; };

/**
 * Returns the (left-tailed) F probability distribution (degree of diversity) for two data sets.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The value at which to evaluate the function, a nonnegative number.
 * @param {ApiRange | ApiName | number} arg2 - The numerator degrees of freedom, a number between 1 and 10^10, excluding 10^10.
 * @param {ApiRange | ApiName | number} arg3 - The denominator degrees of freedom, a number between 1 and 10^10, excluding 10^10.
 * @param {ApiRange | ApiName | boolean} arg4 - A logical value that determines the function form. If this parameter is <b>true</b>,
 * the function will return the cumulative distribution function, if it is <b>false</b>, it will return the probability density function.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.F_DIST = function (arg1, arg2, arg3, arg4) { return 0; };

/**
 * Returns the (right-tailed) F probability distribution (degree of diversity) for two data sets.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The value at which to evaluate the function, a nonnegative number.
 * @param {ApiRange | ApiName | number} arg2 - The numerator degrees of freedom, a number between 1 and 10^10, excluding 10^10.
 * @param {ApiRange | ApiName | number} arg3 - The denominator degrees of freedom, a number between 1 and 10^10, excluding 10^10.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.FDIST = function (arg1, arg2, arg3) { return 0; };

/**
 * Returns the (right-tailed) F probability distribution (degree of diversity) for two data sets.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The value at which to evaluate the function, a nonnegative number.
 * @param {ApiRange | ApiName | number} arg2 - The numerator degrees of freedom, a number between 1 and 10^10, excluding 10^10.
 * @param {ApiRange | ApiName | number} arg3 - The denominator degrees of freedom, a number between 1 and 10^10, excluding 10^10.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.F_DIST_RT = function (arg1, arg2, arg3) { return 0; };

/**
 * Returns the inverse of the (left-tailed) F probability distribution: if p = F.DIST(x,...), then F.INV(p,...) = x.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - A probability associated with the F cumulative distribution, a number between 0 and 1 inclusive.
 * @param {ApiRange | ApiName | number} arg2 - The numerator degrees of freedom, a number between 1 and 10^10, excluding 10^10.
 * @param {ApiRange | ApiName | number} arg3 - The denominator degrees of freedom, a number between 1 and 10^10, excluding 10^10.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.F_INV = function (arg1, arg2, arg3) { return 0; };

/**
 * Returns the inverse of the (right-tailed) F probability distribution: if p = FDIST(x,...), then FINV(p,...) = x.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - A probability associated with the F cumulative distribution, a number between 0 and 1 inclusive.
 * @param {ApiRange | ApiName | number} arg2 - The numerator degrees of freedom, a number between 1 and 10^10, excluding 10^10.
 * @param {ApiRange | ApiName | number} arg3 - The denominator degrees of freedom, a number between 1 and 10^10, excluding 10^10.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.FINV = function (arg1, arg2, arg3) { return 0; };

/**
 * Returns the inverse of the (right-tailed) F probability distribution: if p = F.DIST.RT(x,...), then F.INV.RT(p,...) = x.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - A probability associated with the F cumulative distribution, a number between 0 and 1 inclusive.
 * @param {ApiRange | ApiName | number} arg2 - The numerator degrees of freedom, a number between 1 and 10^10, excluding 10^10.
 * @param {ApiRange | ApiName | number} arg3 - The denominator degrees of freedom, a number between 1 and 10^10, excluding 10^10.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.F_INV_RT = function (arg1, arg2, arg3) { return 0; };

/**
 * Returns the Fisher transformation.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The value for the transformation, a number between -1 and 1, excluding -1 and 1.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.FISHER = function (arg1) { return 0; };

/**
 * Returns the inverse of the Fisher transformation: if y = FISHER(x), then FISHERINV(y) = x.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The value to perform the inverse of the transformation.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.FISHERINV = function (arg1) { return 0; };

/**
//  * Calculates, or predicts, a future value along a linear trend by using existing values.
//  * @memberof ApiWorksheetFunction
//  * @param {ApiRange | ApiName | number} arg1 Is the data point for which you want to predict a value and must be a numeric value.
//  * @param {any} arg2 Is the dependent array or range of numeric data.
//  * @param {any} arg3 Is the independent array or range of numeric data. The variance of Known_x's must not be zero.
//  * @returns {number | string | boolean}
//  */
// ApiWorksheetFunction.prototype.FORECAST = function (arg1, arg2, arg3) { return 0; };

/**
 * A numeric value that specifies which function should be used to aggregate identical time values in the timeline data range.
 * <b>1</b> (or omitted) - AVERAGE.
 * <b>2</b> - COUNT.
 * <b>3</b> - COUNTA.
 * <b>4</b> - MAX.
 * <b>5</b> - MEDIAN.
 * <b>6</b> - MIN.
 * <b>7</b> - SUM.
 * @typedef {(1 | 2 | 3 | 4 | 5 | 6 | 7)} Aggregation
 */

/**
 * Сalculates or predicts a future value based on existing (historical) values by using the AAA version of the Exponential Smoothing (ETS) algorithm.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - A date for which a new value will be predicted. Must be after the last date in the timeline.
 * @param {ApiRange | ApiName | number[]} arg2 - A range or an array of numeric data that determines the historical values for which a new point will be predicted.
 * @param {ApiRange | ApiName} arg3 - A range of date/time values that correspond to the historical values.
 * The timeline range must be of the same size as the second argument. Date/time values must have a constant step between them and can't be zero.
 * @param {ApiRange | ApiName | number} [arg4] - An optional numeric value that specifies the length of the seasonal pattern. The default value of 1 indicates seasonality is detected automatically.
 * The 0 value means no seasonality.
 * @param {ApiRange | ApiName | number} [arg5] - An optional numeric value to handle missing values. The default value of 1 replaces missing values by interpolation, and 0 replaces them with zeros.
 * @param {ApiRange | ApiName | number} [arg6] - An optional numeric value to aggregate multiple values with the same time stamp.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.FORECAST_ETS = function (arg1, arg2, arg3, arg4, arg5, arg6) { return 0; };

/**
 * Returns a confidence interval for the forecast value at the specified target date.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - A date for which a new value will be predicted. Must be after the last date in the timeline.
 * @param {ApiRange | ApiName | number[]} arg2 - A range or an array of numeric data that determines the historical values for which a new point will be predicted.
 * @param {ApiRange | ApiName} arg3 - A range of date/time values that correspond to the historical values.
 * The timeline range must be of the same size as the second argument. Date/time values must have a constant step between them and can't be zero.
 * @param {ApiRange | ApiName | number} [arg4] - A number between 0 and 1 that shows the confidence level for the calculated confidence interval. The default value is .95.
 * @param {ApiRange | ApiName | number} [arg5] - An optional numeric value that specifies the length of the seasonal pattern. The default value of 1 indicates seasonality is detected automatically.
 * The 0 value means no seasonality.
 * @param {ApiRange | ApiName | number} [arg6] - An optional numeric value to handle missing values. The default value of 1 replaces missing values by interpolation, and 0 replaces them with zeros.
 * @param {ApiRange | ApiName | number} [arg7] - An optional numeric value to aggregate multiple values with the same time stamp.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.FORECAST_ETS_CONFINT = function (arg1, arg2, arg3, arg4, arg5, arg6, arg7) { return 0; };

/**
 * Returns the length of the repetitive pattern an application detects for the specified time series.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number[]} arg1 - A range or an array of numeric data that determines the historical values for which a new point will be predicted.
 * @param {ApiRange | ApiName} arg2 - A range of date/time values that correspond to the historical values.
 * The timeline range must be of the same size as the second argument. Date/time values must have a constant step between them and can't be zero.
 * @param {ApiRange | ApiName | number} [arg3] - An optional numeric value to handle missing values. The default value of 1 replaces missing values by interpolation, and 0 replaces them with zeros.
 * @param {ApiRange | ApiName | number} [arg4] - An optional numeric value to aggregate multiple values with the same time stamp.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.FORECAST_ETS_SEASONALITY = function (arg1, arg2, arg3, arg4) { return 0; };

/**
 * A numeric value between 1 and 8 that specifies which statistic will be returned.
 * <b>1</b> - Alpha parameter of ETS algorithm - the base value parameter.
 * <b>2</b> - Beta parameter of ETS algorithm - the trend value parameter.
 * <b>3</b> - Gamma parameter of ETS algorithm - the seasonality value parameter.
 * <b>4</b> - MASE (mean absolute scaled error) metric - a measure of the accuracy of forecasts.
 * <b>5</b> - SMAPE (symmetric mean absolute percentage error) metric - a measure of the accuracy based on percentage errors.
 * <b>6</b> - MAE (mean absolute error) metric - a measure of the accuracy of forecasts.
 * <b>7</b> - RMSE (root mean squared error) metric - a measure of the differences between predicted and observed values.
 * <b>8</b> - Step size detected in the timeline.
 * @typedef {(1 | 2 | 3 | 4 | 5 | 6 | 7 | 8)} StatisticType
 */

/**
 * Returns the requested statistic for the forecast.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number[]} arg1 - A range or an array of numeric data that determines the historical values for which a new point will be predicted.
 * @param {ApiRange | ApiName} arg2 - A range of date/time values that correspond to the historical values.
 * The timeline range must be of the same size as the second argument. Date/time values must have a constant step between them and can't be zero.
 * @param {ApiRange | ApiName | number} arg3 - A number between 1 and 8, indicating which statistic will be returned for the calculated forecast.
 * @param {ApiRange | ApiName | number} [arg4] - An optional numeric value that specifies the length of the seasonal pattern. The default value of 1 indicates seasonality is detected automatically.
 * The 0 value means no seasonality.
 * @param {ApiRange | ApiName | number} [arg5] - An optional numeric value to handle missing values. The default value of 1 replaces missing values by interpolation, and 0 replaces them with zeros.
 * @param {ApiRange | ApiName | number} [arg6] - An optional numeric value to aggregate multiple values with the same time stamp.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.FORECAST_ETS_STAT = function (arg1, arg2, arg3, arg4, arg5, arg6) { return 0; };

/**
//  * Calculates, or predicts, a future value along a linear trend by using existing values.
//  * @memberof ApiWorksheetFunction
//  * @param {ApiRange | ApiName | number} arg1 Is the data point for which you want to predict a value and must be a numeric value.
//  * @param {any} arg2 Is the dependent array or range of numeric data.
//  * @param {any} arg3 Is the independent array or range of numeric data. The variance of Known_x's must not be zero.
//  * @returns {number | string | boolean}
//  */
// ApiWorksheetFunction.prototype.FORECAST_LINEAR = function (arg1, arg2, arg3) { return 0; };

/**
 * Calculates how often values occur within a range of values and then returns the first value of the returned vertical array of numbers.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number[]} arg1 - An array of values or the selected range for which the frequencies will be counted (blanks and text are ignored).
 * @param {ApiRange | ApiName | number[]} arg2 - An array of intervals or the selected range into which the values in the first range will be grouped.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.FREQUENCY = function (arg1, arg2) { return 0; };

/**
//  * Returns the result of an F-test, the two-tailed probability that the variances in Array1 and Array2 are not significantly different.
//  * @memberof ApiWorksheetFunction
//  * @param {any} arg1 Is the first array or range of data and can be numbers or names, arrays, or references that contain numbers (blanks are ignored).
//  * @param {any} arg2 Is the second array or range of data and can be numbers or names, arrays, or references that contain numbers (blanks are ignored).
//  * @returns {number | string | boolean}
//  */
// ApiWorksheetFunction.prototype.FTEST = function (arg1, arg2) { return 0; };

/**
//  * Returns the result of an F-test, the two-tailed probability that the variances in Array1 and Array2 are not significantly different.
//  * @memberof ApiWorksheetFunction
//  * @param {any} arg1 Is the first array or range of data and can be numbers or names, arrays, or references that contain numbers (blanks are ignored).
//  * @param {any} arg2 Is the second array or range of data and can be numbers or names, arrays, or references that contain numbers (blanks are ignored).
//  * @returns {number | string | boolean}
//  */
// ApiWorksheetFunction.prototype.F_TEST = function (arg1, arg2) { return 0; };

/**
 * Returns the gamma function value.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The value for which the gamma function will be calculated.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.GAMMA = function (arg1) { return 0; };

/**
 * Returns the gamma distribution.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The value at which the distribution will be calculated, a nonnegative number.
 * @param {ApiRange | ApiName | number} arg2 - The alpha parameter of the distribution, a positive number.
 * @param {ApiRange | ApiName | number} arg3 - The beta parameter of the distribution, a positive number. If this parameter is equal to 1, the function returns the standard gamma distribution.
 * @param {ApiRange | ApiName | boolean} arg4 - A logical value (<b>true</b>> or <b>false</b>) that determines the function form.
 * If it is <b>true</b>, the function returns the cumulative distribution function. If it is <b>false</b>, the function returns the probability density function.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.GAMMA_DIST = function (arg1, arg2, arg3, arg4) { return 0; };

/**
 * Returns the gamma distribution.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The value at which the distribution will be calculated, a nonnegative number.
 * @param {ApiRange | ApiName | number} arg2 - The alpha parameter of the distribution, a positive number.
 * @param {ApiRange | ApiName | number} arg3 - The beta parameter of the distribution, a positive number. If this parameter is equal to 1, the function returns the standard gamma distribution.
 * @param {ApiRange | ApiName | boolean} arg4 - A logical value (<b>true</b>> or <b>false</b>) that determines the function form.
 * If it is <b>true</b>, the function returns the cumulative distribution function. If it is <b>false</b>, the function returns the probability density function.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.GAMMADIST = function (arg1, arg2, arg3, arg4) { return 0; };

/**
 * Returns the inverse of the gamma cumulative distribution: if p = GAMMA.DIST(x,...), then GAMMA.INV(p,...) = x.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The probability associated with the gamma distribution, a number between 0 and 1, inclusive.
 * @param {ApiRange | ApiName | number} arg2 - The alpha parameter of the distribution, a positive number.
 * @param {ApiRange | ApiName | number} arg3 - The beta parameter of the distribution, a positive number. If this parameter is equal to 1, the function returns the standard gamma distribution.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.GAMMA_INV = function (arg1, arg2, arg3) { return 0; };

/**
 * Returns the inverse of the gamma cumulative distribution: if p = GAMMADIST(x,...), then GAMMAINV(p,...) = x.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The probability associated with the gamma distribution, a number between 0 and 1, inclusive.
 * @param {ApiRange | ApiName | number} arg2 - The alpha parameter of the distribution, a positive number.
 * @param {ApiRange | ApiName | number} arg3 - The beta parameter of the distribution, a positive number. If this parameter is equal to 1, the function returns the standard gamma distribution.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.GAMMAINV = function (arg1, arg2, arg3) { return 0; };

/**
 * Returns the natural logarithm of the gamma function.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The value for which the natural logarithm of the gamma function will be calculated, a positive number.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.GAMMALN = function (arg1) { return 0; };

/**
 * Returns the natural logarithm of the gamma function.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The value for which the natural logarithm of the gamma function will be calculated, a positive number.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.GAMMALN_PRECISE = function (arg1) { return 0; };

/**
 * Calculates the probability that a member of a standard normal population will fall between the mean and arg1 standard deviations from the mean.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The value for which the distribution will be calculated.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.GAUSS = function (arg1) { return 0; };

/**
 * Returns the geometric mean of positive numeric data.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | number[] | ApiName} args - Up to 255 numeric values for which the geometric mean will be calculated.
 * Arguments can be numbers, names, ranges, or arrays of numbers.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.GEOMEAN = function () { return 0; };

/**
 * Calculates predicted exponential growth by using existing data.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number[]} arg1 - The set of y-values from the *y = b*m^x* equation, an array or range of positive numbers.
 * @param {ApiRange | ApiName | number[]} [arg2] - An optional set of x-values from the *y = b*m^x* equation, an array or range of positive numbers that has the same size as the set of y-values.
 * @param {ApiRange | ApiName | number[]} [arg3] - New x-values for which the function will return the corresponding y-values.
 * @param {ApiRange | ApiName | boolean} [arg4] - A logical value: the constant *b* is calculated normally if this parameter is set to <b>true</b>,
 * and *b* is set equal to 1 if the parameter is <b>false</b> or omitted.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.GROWTH = function (arg1, arg2, arg3, arg4) { return 0; };

/**
 * Returns the harmonic mean of a data set of positive numbers: the reciprocal of the arithmetic mean of reciprocals.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | number[] | ApiName} args - Up to 255 numeric values for which the harmonic mean will be calculated.
 * Arguments can be numbers, names, ranges, or arrays of numbers.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.HARMEAN = function () { return 0; };

/**
 * Returns the hypergeometric distribution.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The number of successes in the sample.
 * @param {ApiRange | ApiName | number} arg2 - The size of the sample.
 * @param {ApiRange | ApiName | number} arg3 - The number of successes in the population.
 * @param {ApiRange | ApiName | number} arg4 - The population size.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.HYPGEOMDIST = function (arg1, arg2, arg3, arg4) { return 0; };

/**
 * Returns the hypergeometric distribution.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The number of successes in the sample.
 * @param {ApiRange | ApiName | number} arg2 - The size of the sample.
 * @param {ApiRange | ApiName | number} arg3 - The number of successes in the population.
 * @param {ApiRange | ApiName | number} arg4 - The population size.
 * @param {ApiRange | ApiName | boolean} arg5 - A logical value (<b>true</b> or <b>false</b>) that determines the function form.
 * If it is <b>true</b>, the function returns the cumulative distribution function. If it is <b>false</b>, the function returns the probability mass function.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.HYPGEOM_DIST = function (arg1, arg2, arg3, arg4, arg5) { return 0; };

/**
//  * Calculates the point at which a line will intersect the y-axis by using a best-fit regression line plotted through the known x-values and y-values.
//  * @memberof ApiWorksheetFunction
//  * @param {any} arg1 Is the dependent set of observations or data and can be numbers or names, arrays, or references that contain numbers.
//  * @param {any} arg2 Is the independent set of observations or data and can be numbers or names, arrays, or references that contain numbers.
//  * @returns {number | string | boolean}
//  */
// ApiWorksheetFunction.prototype.INTERCEPT = function (arg1, arg2) { return 0; };

/**
 * Returns the kurtosis of a data set.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | number[] | ApiName} args - Up to 255 numeric values for which the kurtosis will be calculated.
 * Arguments can be numbers, names, ranges, or arrays of numbers.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.KURT = function () { return 0; };

/**
 * Returns the k-th largest value in a data set. For example, the fifth largest number.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number[]} arg1 - The array or range of data for which the k-th largest value will be determined.
 * @param {ApiRange | ApiName | number} arg2 - The position (from the largest) in the array or cell range of data to return.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.LARGE = function (arg1, arg2) { return 0; };

/**
 * Returns statistics that describe a linear trend matching known data points, by fitting a straight line using the least squares method.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName} arg1 - The set of y-values from the *y = mx + b* equation.
 * @param {ApiRange | ApiName} [arg2] - An optional set of x-values from the *y = mx + b* equation.
 * @param {ApiRange | ApiName | boolean} [arg3] - A logical value: the constant *b* is calculated normally if this parameter is set to <b>true</b> or omitted,
 * and *b* is set equal to 0 if the parameter is <b>false</b>.
 * @param {ApiRange | ApiName | boolean} [arg4] - A logical value: return additional regression statistics if this parameter is set to <b>true</b>,
 * and return m-coefficients and the constant *b* if the parameter is <b>false</b> or omitted.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.LINEST = function (arg1, arg2, arg3, arg4) { return 0; };

/**
 * Returns statistics that describe an exponential curve matching known data points.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | ApiRange} arg1 - The set of y-values from the *y = b*m^x* equation.
 * @param {ApiRange | ApiName | ApiRange} [arg2] - An optional set of x-values from the *y = b*m^x* equation.
 * @param {ApiRange | ApiName | boolean} [arg3] - A logical value: the constant *b* is calculated normally if this parameter is set to <b>true</b> or omitted,
 * and *b* is set equal to 1 if the parameter is <b>false</b>.
 * @param {ApiRange | ApiName | boolean} [arg4] - A logical value: return additional regression statistics if this parameter is set to <b>true</b>,
 * and return m-coefficients and the constant *b* if the parameter is <b>false</b> or omitted.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.LOGEST = function (arg1, arg2, arg3, arg4) { return 0; };

/**
 * Returns the inverse of the lognormal cumulative distribution function of x, where ln(x) is normally distributed with the specified parameters.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - A probability associated with the lognormal distribution, a number between 0 and 1, inclusive.
 * @param {ApiRange | ApiName | number} arg2 - The mean of ln(x).
 * @param {ApiRange | ApiName | number} arg3 - The standard deviation of ln(x), a positive number.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.LOGINV = function (arg1, arg2, arg3) { return 0; };

/**
 * Returns the lognormal distribution of x, where ln(x) is normally distributed with the specified parameters.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The value at which to evaluate the function, a positive number.
 * @param {ApiRange | ApiName | number} arg2 - The mean of ln(x).
 * @param {ApiRange | ApiName | number} arg3 - The standard deviation of ln(x), a positive number.
 * @param {ApiRange | ApiName | boolean} arg4 - A logical value (<b>true</b> or <b>false</b>) that determines the function form.
 * If it is <b>true</b>, the function returns the cumulative distribution function.
 * If it is <b>false</b>, the function returns the probability density function.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.LOGNORM_DIST = function (arg1, arg2, arg3, arg4) { return 0; };

/**
 * Returns the inverse of the lognormal cumulative distribution function of x, where ln(x) is normally distributed with the specified parameters.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - A probability associated with the lognormal distribution, a number between 0 and 1, inclusive.
 * @param {ApiRange | ApiName | number} arg2 - The mean of ln(x).
 * @param {ApiRange | ApiName | number} arg3 - The standard deviation of ln(x), a positive number.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.LOGNORM_INV = function (arg1, arg2, arg3) { return 0; };

/**
 * Returns the cumulative lognormal distribution of x, where ln(x) is normally distributed with the specified parameters.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The value at which to evaluate the function, a positive number.
 * @param {ApiRange | ApiName | number} arg2 - The mean of ln(x).
 * @param {ApiRange | ApiName | number} arg3 - The standard deviation of ln(x), a positive number.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.LOGNORMDIST = function (arg1, arg2, arg3) { return 0; };

/**
 * Returns the largest value in a set of values. Ignores logical values and text.
 * @memberof ApiWorksheetFunction
 * @param {number | number[] | ApiRange | ApiName} args - Up to 255 numeric values for which the largest number will be returned.
 * The first argument is required, subsequent arguments are optional. Arguments can be numbers, names, ranges, or arrays of numbers.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.MAX = function () { return 0; };

/**
 * Returns the largest value in a set of values. Does not ignore logical values and text.
 * @memberof ApiWorksheetFunction
 * @param {number | string | boolean | Array<number | string | boolean> | ApiRange | ApiName} args - Up to 255 values (number, text, logical value) for which the largest value will be returned.
 * The first argument is required, subsequent arguments are optional. Arguments can be numbers, logical values and text representations of numbers, names, ranges, or arrays.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.MAXA = function () { return 0; };

/**
 * Returns the median, or the number in the middle of the set of given numbers.
 * @memberof ApiWorksheetFunction
 * @param {number | number[] | ApiRange | ApiName} args - Up to 255 numeric values for which the median will be calculated.
 * The first argument is required, subsequent arguments are optional. Arguments can be numbers, names, ranges, or arrays of numbers.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.MEDIAN = function () { return 0; };

/**
 * Returns the smallest number in a set of values. Ignores logical values and text.
 * @memberof ApiWorksheetFunction
 * @param {number | number[] | ApiRange | ApiName} args - Up to 255 numeric values for which the smallest number will be returned.
 * The first argument is required, subsequent arguments are optional. Arguments can be numbers, names, ranges, or arrays of numbers.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.MIN = function () { return 0; };

/**
 * Returns the smallest value in a set of values. Does not ignore logical values and text.
 * @memberof ApiWorksheetFunction
 * @param {number | string | boolean | Array<number | string | boolean> | ApiRange | ApiName} args - Up to 255 values (number, text, logical value) for which the smallest value will be returned.
 * The first argument is required, subsequent arguments are optional. Arguments can be numbers, logical values and text representations of numbers, names, ranges, or arrays.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.MINA = function () { return 0; };

/**
//  * Returns the most frequently occurring, or repetitive, value in an array or range of data.
//  * @memberof ApiWorksheetFunction
//  * @returns {number | string | boolean}
//  */
// ApiWorksheetFunction.prototype.MODE = function () { return 0; };

/**
//  * Returns a vertical array of the most frequently occurring, or repetitive, values in an array or range of data. For a horizontal array, use =TRANSPOSE(MODE.MULT(number1,number2,...)).
//  * @memberof ApiWorksheetFunction
//  * @returns {number | string | boolean}
//  */
// ApiWorksheetFunction.prototype.MODE_MULT = function () { return 0; };

/**
//  * Returns the most frequently occurring, or repetitive, value in an array or range of data.
//  * @memberof ApiWorksheetFunction
//  * @returns {number | string | boolean}
//  */
// ApiWorksheetFunction.prototype.MODE_SNGL = function () { return 0; };

/**
 * Returns the negative binomial distribution, the probability that there will be the specified number of failures before the last success, with the specified probability of a success.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The number of failures.
 * @param {ApiRange | ApiName | number} arg2 - The threshold number of successes.
 * @param {ApiRange | ApiName | number} arg3 - The probability of a success; a number between 0 and 1.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.NEGBINOMDIST = function (arg1, arg2, arg3) { return 0; };

/**
 * Returns the negative binomial distribution, the probability that there will be the specified number of failures before the last success, with the specified probability of a success.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The number of failures.
 * @param {ApiRange | ApiName | number} arg2 - The threshold number of successes.
 * @param {ApiRange | ApiName | number} arg3 - The probability of a success; a number between 0 and 1.
 * @param {ApiRange | ApiName | boolean} arg4 - A logical value (<b>true</b> or <b>false</b>) that determines the function form.
 * If it is <b>true</b>, the function returns the cumulative distribution function.
 * If it is <b>false</b>, the function returns the probability density function.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.NEGBINOM_DIST = function (arg1, arg2, arg3, arg4) { return 0; };

/**
 * Returns the normal cumulative distribution for the specified mean and standard deviation.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The value for which the distribution will be returned.
 * @param {ApiRange | ApiName | number} arg2 - The arithmetic mean of the distribution.
 * @param {ApiRange | ApiName | number} arg3 - The standard deviation of the distribution, a positive number.
 * @param {ApiRange | ApiName | boolean} arg4 - A logical value (<b>true</b> or <b>false</b>) that determines the function form.
 * If it is <b>true</b>, the function returns the cumulative distribution function.
 * If it is <b>false</b>, the function returns the probability mass function.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.NORMDIST = function (arg1, arg2, arg3, arg4) { return 0; };

/**
 * Returns the normal distribution for the specified mean and standard deviation.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The value for which the distribution will be returned.
 * @param {ApiRange | ApiName | number} arg2 - The arithmetic mean of the distribution.
 * @param {ApiRange | ApiName | number} arg3 - The standard deviation of the distribution, a positive number.
 * @param {ApiRange | ApiName | boolean} arg4 - A logical value (<b>true</b> or <b>false</b>) that determines the function form.
 * If it is <b>true</b>, the function returns the cumulative distribution function.
 * If it is <b>false</b>, the function returns the probability mass function.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.NORM_DIST = function (arg1, arg2, arg3, arg4) { return 0; };

/**
 * Returns the inverse of the normal cumulative distribution for the specified mean and standard deviation.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - A probability corresponding to the normal distribution, a number between 0 and 1 inclusive.
 * @param {ApiRange | ApiName | number} arg2 - The arithmetic mean of the distribution.
 * @param {ApiRange | ApiName | number} arg3 - The standard deviation of the distribution, a positive number.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.NORMINV = function (arg1, arg2, arg3) { return 0; };

/**
 * Returns the inverse of the normal cumulative distribution for the specified mean and standard deviation.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - A probability corresponding to the normal distribution, a number between 0 and 1 inclusive.
 * @param {ApiRange | ApiName | number} arg2 - The arithmetic mean of the distribution.
 * @param {ApiRange | ApiName | number} arg3 - The standard deviation of the distribution, a positive number.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.NORM_INV = function (arg1, arg2, arg3) { return 0; };

/**
 * Returns the standard normal cumulative distribution (has a mean of zero and a standard deviation of one).
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The value for which the distribution will be returned.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.NORMSDIST = function (arg1) { return 0; };

/**
 * Returns the standard normal distribution (has a mean of zero and a standard deviation of one).
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The value for which the distribution will be returned.
 * @param {ApiRange | ApiName | boolean} arg2 - A logical value (<b>true</b> or <b>false</b>) that determines the function form.
 * If it is <b>true</b>, the function returns the cumulative distribution function.
 * If it is <b>false</b>, the function returns the probability mass function.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.NORM_S_DIST = function (arg1, arg2) { return 0; };

/**
 * Returns the inverse of the standard normal cumulative distribution (has a mean of zero and a standard deviation of one).
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - A probability corresponding to the normal distribution, a number between 0 and 1 inclusive.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.NORMSINV = function (arg1) { return 0; };

/**
 * Returns the inverse of the standard normal cumulative distribution (has a mean of zero and a standard deviation of one).
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - A probability corresponding to the normal distribution, a number between 0 and 1 inclusive.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.NORM_S_INV = function (arg1) { return 0; };

/**
//  * Returns the Pearson product moment correlation coefficient, r.
//  * @memberof ApiWorksheetFunction
//  * @param {any} arg1 Is a set of independent values.
//  * @param {any} arg2 Is a set of dependent values.
//  * @returns {number | string | boolean}
//  */
// ApiWorksheetFunction.prototype.PEARSON = function (arg1, arg2) { return 0; };

/**
 * Returns the k-th percentile of values in a range.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number[]} arg1 - The array or range of data that defines relative standing.
 * @param {ApiRange | ApiName | number} arg2 - The percentile value that is equal to 0 but less than or equal to 1.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.PERCENTILE = function (arg1, arg2) { return 0; };

/**
 * Returns the k-th percentile of values in a range, where k is in the range 0..1, exclusive.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number[]} arg1 - The array or range of data that defines relative standing.
 * @param {ApiRange | ApiName | number} arg2 - The percentile value that is greater than 0 but less than 1.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.PERCENTILE_EXC = function (arg1, arg2) { return 0; };

/**
 * Returns the k-th percentile of values in a range, where k is in the range 0..1, inclusive.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number[]} arg1 - The array or range of data that defines relative standing.
 * @param {ApiRange | ApiName | number} arg2 - The percentile value that is equal to 0 but less than or equal to 1.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.PERCENTILE_INC = function (arg1, arg2) { return 0; };

/**
 * Returns the rank of a value in a data set as a percentage of the data set.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number[]} arg1 - The array or range of data with numeric values that defines relative standing.
 * @param {ApiRange | ApiName | number} arg2 - The value for which the rank will be returned.
 * @param {ApiRange | ApiName | number} [arg3] - An optional value that identifies the number of significant digits for the returned percentage, three digits if omitted (0.xxx%).
 * @returns {number}
 */
ApiWorksheetFunction.prototype.PERCENTRANK = function (arg1, arg2, arg3) { return 0; };

/**
 * Returns the rank of a value in a data set as a percentage (0..1, exclusive) of the data set.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number[]} arg1 - The array or range of data with numeric values that defines relative standing.
 * @param {ApiRange | ApiName | number} arg2 - The value for which the rank will be returned.
 * @param {ApiRange | ApiName | number} [arg3] - An optional value that identifies the number of significant digits for the returned percentage, three digits if omitted (0.xxx%).
 * @returns {number}
 */
ApiWorksheetFunction.prototype.PERCENTRANK_EXC = function (arg1, arg2, arg3) { return 0; };

/**
 * Returns the rank of a value in a data set as a percentage (0..1, inclusive) of the data set.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number[]} arg1 - The array or range of data with numeric values that defines relative standing.
 * @param {ApiRange | ApiName | number} arg2 - The value for which the rank will be returned.
 * @param {ApiRange | ApiName | number} [arg3] - An optional value that identifies the number of significant digits for the returned percentage, three digits if omitted (0.xxx%).
 * @returns {number}
 */
ApiWorksheetFunction.prototype.PERCENTRANK_INC = function (arg1, arg2, arg3) { return 0; };

/**
 * Returns the number of permutations for a given number of objects that can be selected from the total objects.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The total number of objects.
 * @param {ApiRange | ApiName | number} arg2 - The number of objects in each permutation.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.PERMUT = function (arg1, arg2) { return 0; };

/**
 * Returns the number of permutations for a given number of objects (with repetitions) that can be selected from the total objects.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The total number of objects.
 * @param {ApiRange | ApiName | number} arg2 - The number of objects in each permutation.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.PERMUTATIONA = function (arg1, arg2) { return 0; };

/**
 * Returns the value of the density function for a standard normal distribution.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The number for which the density of the standard normal distribution will be returned.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.PHI = function (arg1) { return 0; };

/**
 * Returns the Poisson distribution.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The number of events.
 * @param {ApiRange | ApiName | number} arg2 - The expected numeric value, a positive number.
 * @param {ApiRange | ApiName | boolean} arg3 - A logical value (<b>true</b> or <b>false</b>) that determines the function form.
 * If it is <b>true</b>, the function returns the cumulative Poisson probability.
 * If it is <b>false</b>, the function returns the Poisson probability mass function.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.POISSON = function (arg1, arg2, arg3) { return 0; };

/**
 * Returns the Poisson distribution.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The number of events.
 * @param {ApiRange | ApiName | number} arg2 - The expected numeric value, a positive number.
 * @param {ApiRange | ApiName | boolean} arg3 - A logical value (<b>true</b> or <b>false</b>) that determines the function form.
 * If it is <b>true</b>, the function returns the cumulative Poisson probability.
 * If it is <b>false</b>, the function returns the Poisson probability mass function.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.POISSON_DIST = function (arg1, arg2, arg3) { return 0; };

/**
//  * Returns the probability that values in a range are between two limits or equal to a lower limit.
//  * @memberof ApiWorksheetFunction
//  * @param {any} arg1 Is the range of numeric values of x with which there are associated probabilities.
//  * @param {any} arg2 Is the set of probabilities associated with values in X_range, values between 0 and 1 and excluding 0.
//  * @param {ApiRange | ApiName | number} arg3 Is the lower bound on the value for which you want a probability.
//  * @param {ApiRange | ApiName | number} [arg4] Is the optional upper bound on the value. If omitted, PROB returns the probability that X_range values are equal to Lower_limit.
//  * @returns {number | string | boolean}
//  */
// ApiWorksheetFunction.prototype.PROB = function (arg1, arg2, arg3, arg4) { return 0; };

/**
 * Returns the quartile of a data set.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number[]} arg1 - The array or cell range of numeric values for which the quartile value will be returned.
 * @param {ApiRange | ApiName | number} arg2 - The quartile value to return: minimum value = 0; 1st quartile = 1; median value = 2; 3rd quartile = 3; maximum value = 4.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.QUARTILE = function (arg1, arg2) { return 0; };

/**
 * Returns the quartile of a data set, based on percentile values from 0..1, exclusive.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number[]} arg1 - The array or cell range of numeric values for which the quartile value will be returned.
 * @param {ApiRange | ApiName | number} arg2 - The quartile value to return: 1st quartile = 1; median value = 2; 3rd quartile = 3.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.QUARTILE_EXC = function (arg1, arg2) { return 0; };

/**
 * Returns the quartile of a data set, based on percentile values from 0..1, inclusive.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number[]} arg1 - The array or cell range of numeric values for which the quartile value will be returned.
 * @param {ApiRange | ApiName | number} arg2 - The quartile value to return: minimum value = 0; 1st quartile = 1; median value = 2; 3rd quartile = 3; maximum value = 4.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.QUARTILE_INC = function (arg1, arg2) { return 0; };

/**
 * Returns the rank of a number in a list of numbers: its size relative to other values in the list.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The number for which the rank will be returned.
 * @param {ApiRange | ApiName | number[]} arg2 - An array or range of numbers. Nonnumeric values are ignored.
 * @param {ApiRange | ApiName | boolean} [arg3] - The numeric value that specifyes how to order the numbers. If it is 0 or omitted, the rank in the list will be sorted in descending order.
 * Any other numeric value means that the rank in the list will be sorted in ascending order.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.RANK = function (arg1, arg2, arg3) { return 0; };

/**
 * Returns the rank of a number in a list of numbers: its size relative to other values in the list. If more than one value has the same rank, the average rank is returned.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The number for which the rank will be returned.
 * @param {ApiRange | ApiName | number[]} arg2 - An array or range of numbers. Nonnumeric values are ignored.
 * @param {ApiRange | ApiName | boolean} [arg3] - The numeric value that specifyes how to order the numbers. If it is 0 or omitted, the rank in the list will be sorted in descending order.
 * Any other numeric value means that the rank in the list will be sorted in ascending order.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.RANK_AVG = function (arg1, arg2, arg3) { return 0; };

/**
 * Returns the rank of a number in a list of numbers: its size relative to other values in the list. If more than one value has the same rank, the top rank of that set of values is returned.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The number for which the rank will be returned.
 * @param {ApiRange | ApiName | number[]} arg2 - An array or range of numbers. Nonnumeric values are ignored.
 * @param {ApiRange | ApiName | boolean} [arg3] - The numeric value that specifyes how to order the numbers. If it is 0 or omitted, the rank in the list will be sorted in descending order.
 * Any other numeric value means that the rank in the list will be sorted in ascending order.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.RANK_EQ = function (arg1, arg2, arg3) { return 0; };

/**
//  * Returns the square of the Pearson product moment correlation coefficient through the given data points.
//  * @memberof ApiWorksheetFunction
//  * @param {any} arg1 Is an array or range of data points and can be numbers or names, arrays, or references that contain numbers.
//  * @param {any} arg2 Is an array or range of data points and can be numbers or names, arrays, or references that contain numbers.
//  * @returns {number | string | boolean}
//  */
// ApiWorksheetFunction.prototype.RSQ = function (arg1, arg2) { return 0; };

/**
 * Returns the skewness of a distribution: a characterization of the degree of asymmetry of a distribution around its mean.
 * @memberof ApiWorksheetFunction
 * @param {number | ApiName | number[] | ApiRange} args - Up to 255 numeric values for which the skewness of a distribution will be returned.
 * The first argument is required, subsequent arguments are optional. Arguments can be numbers, names, ranges, or arrays of numbers.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.SKEW = function () { return 0; };

/**
 * Returns the skewness of a distribution based on a population: a characterization of the degree of asymmetry of a distribution around its mean.
 * @memberof ApiWorksheetFunction
 * @param {number | ApiName | number[] | ApiRange} args - Up to 255 numeric values for which the skewness of a distribution will be returned.
 * The first argument is required, subsequent arguments are optional. Arguments can be numbers, names, ranges, or arrays of numbers.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.SKEW_P = function () { return 0; };

/**
//  * Returns the slope of the linear regression line through the given data points.
//  * @memberof ApiWorksheetFunction
//  * @param {any} arg1 Is an array or cell range of numeric dependent data points and can be numbers or names, arrays, or references that contain numbers.
//  * @param {any} arg2 Is the set of independent data points and can be numbers or names, arrays, or references that contain numbers.
//  * @returns {number | string | boolean}
//  */
// ApiWorksheetFunction.prototype.SLOPE = function (arg1, arg2) { return 0; };

/**
 * Returns the k-th smallest value in a data set. For example, the fifth smallest number.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number[]} arg1 - An array or range of numerical data for which the k-th smallest value will be determined.
 * @param {ApiRange | ApiName | number} arg2 - The position (from the smallest) in the range of the value to return.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.SMALL = function (arg1, arg2) { return 0; };

/**
 * Returns a normalised value from a distribution characterised by a mean and standard deviation.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The value to normalize.
 * @param {ApiRange | ApiName | number} arg2 - The arithmetic mean of the distribution.
 * @param {ApiRange | ApiName | number} arg3 - The standard deviation of the distribution, a positive number.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.STANDARDIZE = function (arg1, arg2, arg3) { return 0; };

/**
 * Estimates standard deviation based on a sample (ignores logical values and text in the sample).
 * @memberof ApiWorksheetFunction
 * @param {number[] | number | ApiName | ApiRange} args - Up to 255 numeric values for which the standard deviation will be calculated.
 * The first argument is required, subsequent arguments are optional. Arguments can be numbers, names, ranges, or arrays of numbers.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.STDEV = function () { return 0; };

/**
 * Estimates standard deviation based on a sample (ignores logical values and text in the sample).
 * @memberof ApiWorksheetFunction
 * @param {number[] | number | ApiName | ApiRange} args - Up to 255 numeric values for which the standard deviation will be calculated.
 * The first argument is required, subsequent arguments are optional. Arguments can be numbers, names, ranges, or arrays of numbers.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.STDEV_S = function () { return 0; };

/**
 * Estimates standard deviation based on a sample, including logical values and text. Text and the <b>false</b> logical value have the value 0; the <b>true</b> logical value has the value 1.
 * @memberof ApiWorksheetFunction
 * @param {number[] | number | string | boolean | ApiRange | ApiName} args - Up to 255 values for which the standard deviation will be calculated.
 * The first argument is required, subsequent arguments are optional. Arguments can be numbers, logical values, text strings, names, ranges, or arrays.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.STDEVA = function () { return 0; };

/**
 * Calculates standard deviation based on the entire population given as arguments (ignores logical values and text).
 * @memberof ApiWorksheetFunction
 * @param {number[] | number | ApiName | ApiRange} args - Up to 255 numeric values for which the standard deviation will be calculated.
 * The first argument is required, subsequent arguments are optional. Arguments can be numbers, names, ranges, or arrays of numbers.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.STDEVP = function () { return 0; };

/**
 * Calculates standard deviation based on the entire population given as arguments (ignores logical values and text).
 * @memberof ApiWorksheetFunction
 * @param {number[] | number | ApiName | ApiRange} args - Up to 255 numeric values for which the standard deviation will be calculated.
 * The first argument is required, subsequent arguments are optional. Arguments can be numbers, names, ranges, or arrays of numbers.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.STDEV_P = function () { return 0; };

/**
 * Calculates standard deviation based on the entire population, including logical values and text.
 * Text and the <b>false</b> logical value have the value 0; the <b>true</b> logical value has the value 1.
 * @memberof ApiWorksheetFunction
 * @param {number[] | number | string | boolean | ApiRange | ApiName} args - Up to 255 values for which the standard deviation will be calculated.
 * The first argument is required, subsequent arguments are optional. Arguments can be numbers, logical values, text strings, names, ranges, or arrays.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.STDEVPA = function () { return 0; };

/**
//  * Returns the standard error of the predicted y-value for each x in a regression.
//  * @memberof ApiWorksheetFunction
//  * @param {any} arg1 Is an array or range of dependent data points and can be numbers or names, arrays, or references that contain numbers.
//  * @param {any} arg2 Is an array or range of independent data points and can be numbers or names, arrays, or references that contain numbers.
//  * @returns {number | string | boolean}
//  */
// ApiWorksheetFunction.prototype.STEYX = function (arg1, arg2) { return 0; };

/**
 * Returns the Student's t-distribution.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The numeric value at which to evaluate the distribution.
 * @param {ApiRange | ApiName | number} arg2 - An integer indicating the number of degrees of freedom that characterize the distribution.
 * @param {ApiRange | ApiName | number} arg3 - Specifies the number of distribution tails to return: one-tailed distribution = 1; two-tailed distribution = 2.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.TDIST = function (arg1, arg2, arg3) { return 0; };

/**
 * Returns the left-tailed Student's t-distribution.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The numeric value at which to evaluate the distribution.
 * @param {ApiRange | ApiName | number} arg2 - An integer indicating the number of degrees of freedom that characterize the distribution.
 * @param {ApiRange | ApiName | boolean} arg3 - A logical value (<b>true</b> or <b>false</b>) that determines the function form.
 * If it is <b>true</b>, the function returns the cumulative distribution function.
 * If it is <b>false</b>, the function returns the probability density function.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.T_DIST = function (arg1, arg2, arg3) { return 0; };

/**
 * Returns the two-tailed Student's t-distribution.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The numeric value at which to evaluate the distribution.
 * @param {ApiRange | ApiName | number} arg2 - An integer indicating the number of degrees of freedom that characterize the distribution.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.T_DIST_2T = function (arg1, arg2) { return 0; };

/**
 * Returns the right-tailed Student's t-distribution.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The numeric value at which to evaluate the distribution.
 * @param {ApiRange | ApiName | number} arg2 - An integer indicating the number of degrees of freedom that characterize the distribution.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.T_DIST_RT = function (arg1, arg2) { return 0; };

/**
 * Returns the left-tailed inverse of the Student's t-distribution.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The probability associated with the two-tailed Student's t-distribution, a number between 0 and 1 inclusive.
 * @param {ApiRange | ApiName | number} arg2 - A positive integer indicating the number of degrees of freedom to characterize the distribution.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.T_INV = function (arg1, arg2) { return 0; };

/**
 * Returns the two-tailed inverse of the Student's t-distribution.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The probability associated with the two-tailed Student's t-distribution, a number between 0 and 1 inclusive.
 * @param {ApiRange | ApiName | number} arg2 - A positive integer indicating the number of degrees of freedom to characterize the distribution.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.T_INV_2T = function (arg1, arg2) { return 0; };

/**
 * Returns the two-tailed inverse of the Student's t-distribution.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The probability associated with the two-tailed Student's t-distribution, a number between 0 and 1 inclusive.
 * @param {ApiRange | ApiName | number} arg2 - A positive integer indicating the number of degrees of freedom to characterize the distribution.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.TINV = function (arg1, arg2) { return 0; };

/**
 * Returns numbers in a linear trend matching known data points, using the least squares method.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number[]} arg1 - A range or array of y-values from the *y = mx + b* equation.
 * @param {ApiRange | ApiName | number[]} [arg2] - An optional range or array of x-values from the *y = mx + b* equation, an array of the same size as an array of y-values.
 * @param {ApiRange | ApiName | number[]} [arg3] - A range or array of new x-values for which this function will return corresponding y-values.
 * @param {ApiRange | ApiName | boolean} [arg4] - A logical value: the constant *b* is calculated normally if this parameter is set to <b>true</b> or omitted,
 * and *b* is set equal to 0 if the parameter is <b>false</b>.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.TREND = function (arg1, arg2, arg3, arg4) { return 0; };

/**
 * Returns the mean of the interior portion of a set of data values.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number[]} arg1 - The array or range of values to trim and average.
 * @param {ApiRange | ApiName | number} arg2 - The fractional number of data points to exclude from the top and bottom of the data set.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.TRIMMEAN = function (arg1, arg2) { return 0; };

/**
//  * Returns the probability associated with a Student's t-Test.
//  * @memberof ApiWorksheetFunction
//  * @param {any} arg1 Is the first data set.
//  * @param {any} arg2 Is the second data set.
//  * @param {ApiRange | ApiName | number} arg3 Specifies the number of distribution tails to return: one-tailed distribution = 1; two-tailed distribution = 2.
//  * @param {ApiRange | ApiName | number} arg4 Is the kind of t-test: paired = 1, two-sample equal variance (homoscedastic) = 2, two-sample unequal variance = 3.
//  * @returns {number | string | boolean}
//  */
// ApiWorksheetFunction.prototype.TTEST = function (arg1, arg2, arg3, arg4) { return 0; };

/**
//  * Returns the probability associated with a Student's t-Test.
//  * @memberof ApiWorksheetFunction
//  * @param {any} arg1 Is the first data set.
//  * @param {any} arg2 Is the second data set.
//  * @param {ApiRange | ApiName | number} arg3 Specifies the number of distribution tails to return: one-tailed distribution = 1; two-tailed distribution = 2.
//  * @param {ApiRange | ApiName | number} arg4 Is the kind of t-test: paired = 1, two-sample equal variance (homoscedastic) = 2, two-sample unequal variance = 3.
//  * @returns {number | string | boolean}
//  */
// ApiWorksheetFunction.prototype.T_TEST = function (arg1, arg2, arg3, arg4) { return 0; };

/**
 * Estimates variance based on a sample (ignores logical values and text in the sample).
 * @memberof ApiWorksheetFunction
 * @param {number | ApiName | ApiRange | number[]} args - Up to 255 numeric values for which the variance will be calculated.
 * The first argument is required, subsequent arguments are optional. Arguments can be numbers, names, ranges, or arrays of numbers.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.VAR = function () { return 0; };

/**
 * Estimates variance based on a sample, including logical values and text. Text and the <b>false</b> logical value have the value 0; the <b>true</b> logical value has the value 1.
 * @memberof ApiWorksheetFunction
 * @param {number | string | boolean | Array<number | string | boolean> | ApiRange | ApiName} args - Up to 255 values for which the variance will be calculated.
 * The first argument is required, subsequent arguments are optional. Arguments can be numbers, logical values or text representations of numbers, names, ranges, or arrays.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.VARA = function () { return 0; };

/**
 * Calculates variance based on the entire population (ignores logical values and text in the population).
 * @memberof ApiWorksheetFunction
 * @param {number | ApiName | ApiRange | number[]} args - Up to 255 numeric values for which the variance will be calculated.
 * The first argument is required, subsequent arguments are optional. Arguments can be numbers, names, ranges, or arrays of numbers.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.VARP = function () { return 0; };

/**
 * Calculates variance based on the entire population (ignores logical values and text in the population).
 * @memberof ApiWorksheetFunction
 * @param {number | ApiName | ApiRange | number[]} args - Up to 255 numeric values for which the variance will be calculated.
 * The first argument is required, subsequent arguments are optional. Arguments can be numbers, names, ranges, or arrays of numbers.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.VAR_P = function () { return 0; };

/**
 * Estimates variance based on a sample (ignores logical values and text in the sample).
 * @memberof ApiWorksheetFunction
 * @param {number | ApiName | ApiRange | number[]} args - Up to 255 numeric values for which the variance will be calculated.
 * The first argument is required, subsequent arguments are optional. Arguments can be numbers, names, ranges, or arrays of numbers.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.VAR_S = function () { return 0; };

/**
 * Calculates variance based on the entire population, including logical values and text. Text and the <b>false</b> logical value have the value 0; the <b>true</b> logical value has the value 1.
 * @memberof ApiWorksheetFunction
 * @param {number | string | boolean | Array<number | string | boolean> | ApiRange | ApiName} args - Up to 255 values for which the variance will be calculated.
 * The first argument is required, subsequent arguments are optional. Arguments can be numbers, logical values or text representations of numbers, names, ranges, or arrays.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.VARPA = function () { return 0; };

/**
 * Returns the Weibull distribution.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The value at which to evaluate the function, a nonnegative number.
 * @param {ApiRange | ApiName | number} arg2 - The alpha parameter of the distribution, a positive number.
 * @param {ApiRange | ApiName | number} arg3 - The beta parameter of the distribution, a positive number.
 * @param {ApiRange | ApiName | boolean} arg4 - A logical value (<b>true</b> or <b>false</b>) that determines the function form.
 * If it is <b>true</b>, the function returns the cumulative distribution function.
 * If it is <b>false</b>, the function returns the probability mass function.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.WEIBULL = function (arg1, arg2, arg3, arg4) { return 0; };

/**
 * Returns the Weibull distribution.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The value at which to evaluate the function, a nonnegative number.
 * @param {ApiRange | ApiName | number} arg2 - The alpha parameter of the distribution, a positive number.
 * @param {ApiRange | ApiName | number} arg3 - The beta parameter of the distribution, a positive number.
 * @param {ApiRange | ApiName | boolean} arg4 - A logical value (<b>true</b> or <b>false</b>) that determines the function form.
 * If it is <b>true</b>, the function returns the cumulative distribution function.
 * If it is <b>false</b>, the function returns the probability mass function.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.WEIBULL_DIST = function (arg1, arg2, arg3, arg4) { return 0; };

/**
 * Returns the one-tailed P-value of a z-test.
 * @memberof ApiWorksheetFunction
 * @param {number[] | ApiRange | ApiName} arg1 - The array or range of data against which to test X.
 * @param {ApiRange | ApiName | number} arg2 - The value to test.
 * @param {ApiRange | ApiName | number} [arg3] - The population (known) standard deviation. If omitted, the sample standard deviation is used.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.ZTEST = function (arg1, arg2, arg3) { return 0; };

/**
 * Returns the one-tailed P-value of a z-test.
 * @memberof ApiWorksheetFunction
 * @param {number[] | ApiRange} arg1 - The array or range of data against which to test X.
 * @param {ApiRange | ApiName | number} arg2 - The value to test.
 * @param {ApiRange | ApiName | number} [arg3] - The population (known) standard deviation. If omitted, the sample standard deviation is used.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.Z_TEST = function (arg1, arg2, arg3) { return 0; };

/**
 * Returns a number that represents the date in the date-time code.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - A number from 1900 or 1904 (depending on the workbook's date system) to 9999.
 * @param {ApiRange | ApiName | number} arg2 - A number from 1 to 12 representing the month of the year.
 * @param {ApiRange | ApiName | number} arg3 - A number from 1 to 31 representing the day of the month.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.DATE = function (arg1, arg2, arg3) { return 0; };

/**
 * Converts a date in the form of text to a number that represents the date in the date-time code.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | string} arg1 - The text that represents a date, between 1/1/1900 or 1/1/1904 (depending on the workbook's date system) and 12/31/9999.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.DATEVALUE = function (arg1) { return 0; };

/**
 * Returns the day of the date given in the numerical format, a number from 1 to 31.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - A number in the date-time code.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.DAY = function (arg1) { return 0; };

/**
 * Returns the number of days between the two dates.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - Start date from which days will be counted.
 * @param {ApiRange | ApiName | number} arg2 - End date until which days will be counted.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.DAYS = function (arg1, arg2) { return 0; };

/**
 * Returns the number of days between two dates based on a 360-day year (twelve 30-day months).
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - Start date from which days will be counted.
 * @param {ApiRange | ApiName | number} arg2 - End date until which days will be counted.
 * @param {ApiRange | ApiName | boolean} [arg3] - A logical value that specifies whether to use the U.S. (NASD) (false or omitted) or European (true) method in the calculation.
 * According to the European method, the start and end dates that occur on the 31st of a month become equal to the 30th of the same month.
 * According to the U.S. method, the start date is the last day of a month, it becomes equal to the 30th of the same month.
 * If the end date is the last day of a month and the start date is earlier than the 30th of a month, the end date becomes equal to the 1st of the next month.
 * Otherwise the end date becomes equal to the 30th of the same month.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.DAYS360 = function (arg1, arg2, arg3) { return 0; };

/**
 * Returns the serial number of the date which comes the indicated number of months before or after the start date.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - A serial date number that represents the start date.
 * @param {ApiRange | ApiName | number} arg2 - The number of months before or after the start date.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.EDATE = function (arg1, arg2) { return 0; };

/**
 * Returns the serial number of the last day of the month before or after the specified number of months.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - A serial date number that represents the start date.
 * @param {ApiRange | ApiName | number} arg2 - The number of months before or after the start date.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.EOMONTH = function (arg1, arg2) { return 0; };

/**
 * Returns the hour as a number from 0 (12:00 A.M.) to 23 (11:00 P.M.).
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number | string} arg1 - A number in the date-time code, or text in the time format, such as "16:48:00" or "4:48:00 PM", or a result of other formulas or functions.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.HOUR = function (arg1) { return 0; };

/**
 * Returns the ISO week number in the year for a given date.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The date-time code used for date and time calculation.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.ISOWEEKNUM = function (arg1) { return 0; };

/**
 * Returns the minute, a number from 0 to 59.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number | string} arg1 - A number in the date-time code, or text in the time format, such as "16:48:00" or "4:48:00 PM", or a result of other formulas or functions.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.MINUTE = function (arg1) { return 0; };

/**
 * Returns the month, a number from 1 (January) to 12 (December).
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1- A number in the date-time code.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.MONTH = function (arg1) { return 0; };

/**
 * Returns the number of whole workdays between two dates.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - A serial date number that represents the start date.
 * @param {ApiRange | ApiName | number} arg2 - A serial date number that represents the end date.
 * @param {ApiRange | number[]} [arg3] - An optional range or array of one or more serial date numbers to exclude from the working calendar, such as state and federal holidays and floating holidays.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.NETWORKDAYS = function (arg1, arg2, arg3) { return 0; };

/**
 * Returns the number of whole workdays between two dates with custom weekend parameters.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - A serial date number that represents the start date.
 * @param {ApiRange | ApiName | number} arg2 - A serial date number that represents the end date.
 * @param {ApiRange | ApiName | number | string} [arg3] - A number or string specifying when weekends occur.
 * @param {ApiRange | number[]} [arg4] - An optional range or array of one or more serial date numbers to exclude from the working calendar, such as state and federal holidays and floating holidays.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.NETWORKDAYS_INTL = function (arg1, arg2, arg3, arg4) { return 0; };

/**
 * Returns the current date and time in the *MM/dd/yy hh:mm* format.
 * @memberof ApiWorksheetFunction
 * @returns {number}
 */
ApiWorksheetFunction.prototype.NOW = function () { return 0; };

/**
 * Returns the second, a number from 0 to 59.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number | string} arg1 - A number in the date-time code, or text in the time format, such as "16:48:00" or "4:48:00 PM", or a result of other formulas or functions.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.SECOND = function (arg1) { return 0; };

/**
 * Converts hours, minutes and seconds given as numbers to a serial number, formatted with the time format.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - A number from 0 to 23 representing the hour.
 * @param {ApiRange | ApiName | number} arg2 - A number from 0 to 59 representing the minute.
 * @param {ApiRange | ApiName | number} arg3 - A number from 0 to 59 representing the second.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.TIME = function (arg1, arg2, arg3) { return 0; };

/**
 * Converts a text time to a serial number for a time, a number from 0 (12:00:00 AM) to 0.999988426 (11:59:59 PM). Format the number with a time format after entering the formula.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | string} arg1 - A text string that represents a time in one of the time formats (date information in the string is ignored).
 * @returns {number}
 */
ApiWorksheetFunction.prototype.TIMEVALUE = function (arg1) { return 0; };

/**
 * Returns the current date in the *MM/dd/yy* format.
 * @memberof ApiWorksheetFunction
 * @returns {number}
 */
ApiWorksheetFunction.prototype.TODAY = function () { return 0; };

/**
 * Returns a number from 1 to 7 identifying the day of the week of the specified date.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - A number that represents a date, or a result of other formulas or functions.
 * @param {ApiRange | ApiName | number} [arg2] - A number that determines the type of return value: <b>1</b> - returns a number from 1 (Sunday) to 7 (Saturday);
 * <b>2</b> - returns a number from 1 (Monday) to 7 (Sunday); <b>3</b> - returns a number from 0 (Monday) to 6 (Sunday).
 * @returns {number}
 */
ApiWorksheetFunction.prototype.WEEKDAY = function (arg1, arg2) { return 0; };

/**
 * Returns the week number in the year.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The date-time code used for date and time calculation.
 * @param {ApiRange | ApiName | number} [arg2] - A number (1 or 2) that determines the type of the return value: Sunday (1) or Monday (2).
 * @returns {number}
 */
ApiWorksheetFunction.prototype.WEEKNUM = function (arg1, arg2) { return 0; };

/**
 * Returns the serial number of the date before or after a specified number of workdays.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - A serial date number that represents the start date.
 * @param {ApiRange | ApiName | number} arg2 - The number of nonweekend and non-holiday days before or after the start date. A positive value for days yields a future date; a negative value yields a past date.
 * @param {ApiRange | ApiName | number[]} [arg3] - An optional range or array of one or more serial date numbers to exclude from the working calendar, such as state and federal holidays and floating holidays.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.WORKDAY = function (arg1, arg2, arg3) { return 0; };

/**
 * Returns the serial number of the date before or after a specified number of workdays with custom weekend parameters.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - A serial date number that represents the start date.
 * @param {ApiRange | ApiName | number} arg2 - The number of nonweekend and non-holiday days before or after the start date. A positive value for days yields a future date; a negative value yields a past date.
 * @param {ApiRange | ApiName | number | string} [arg3] - A number or string specifying when weekends occur.
 * @param {ApiRange | ApiName | number[]} [arg4] - An optional range or array of one or more serial date numbers to exclude from the working calendar, such as state and federal holidays and floating holidays.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.WORKDAY_INTL = function (arg1, arg2, arg3, arg4) { return 0; };

/**
 * Returns the year of a date, an integer in the range 1900-9999.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - A number in the date-time code, or a result of other formulas or functions.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.YEAR = function (arg1) { return 0; };

/**
 * Returns the year fraction representing the number of whole days between the start date and end date.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - A serial date number that represents the start date.
 * @param {ApiRange | ApiName | number} arg2 - A serial date number that represents the end date.
 * @param {ApiRange | ApiName | number} [arg3] - The type of day count basis to use: <b>0</b> or omitted - US (NASD) 30/360; <b>1</b> - Actual/actual; <b>2</b> - Actual/360; <b>3</b> - Actual/365; <b>4</b> - European 30/360.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.YEARFRAC = function (arg1, arg2, arg3) { return 0; };

/**
 * Returns the modified Bessel function In(x).
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The value at which to evaluate the function.
 * @param {ApiRange | ApiName | number} arg2 - The order of the Bessel function.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.BESSELI = function (arg1, arg2) { return 0; };

/**
 * Returns the Bessel function Jn(x).
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The value at which to evaluate the function.
 * @param {ApiRange | ApiName | number} arg2 - The order of the Bessel function.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.BESSELJ = function (arg1, arg2) { return 0; };

/**
 * Returns the modified Bessel function Kn(x).
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The value at which to evaluate the function.
 * @param {ApiRange | ApiName | number} arg2 - The order of the function.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.BESSELK = function (arg1, arg2) { return 0; };

/**
 * Returns the Bessel function Yn(x).
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The value at which to evaluate the function.
 * @param {ApiRange | ApiName | number} arg2 - The order of the function.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.BESSELY = function (arg1, arg2) { return 0; };

/**
 * Converts a binary number to decimal.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The binary number which will be convertrd.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.BIN2DEC = function (arg1) { return 0; };

/**
 * Converts a binary number to hexadecimal.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The binary number which will be convertrd.
 * @param {ApiRange | ApiName | number} [arg2] - The number of characters to use.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.BIN2HEX = function (arg1, arg2) { return 0; };

/**
 * Converts a binary number to octal.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The binary number which will be convertrd.
 * @param {ApiRange | ApiName | number} [arg2] - The number of characters to use.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.BIN2OCT = function (arg1, arg2) { return 0; };

/**
 * Returns a bitwise "AND" of two numbers.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The first decimal representation of the binary number to evaluate.
 * @param {ApiRange | ApiName | number} arg2 - The second decimal representation of the binary number to evaluate.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.BITAND = function (arg1, arg2) { return 0; };

/**
 * Returns a number shifted left by the specified number of bits.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The decimal representation of the binary number to evaluate.
 * @param {ApiRange | ApiName | number} arg2 - The number of bits by which the number will be shifted left.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.BITLSHIFT = function (arg1, arg2) { return 0; };

/**
 * Returns a bitwise "OR" of two numbers.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The first decimal representation of the binary number to evaluate.
 * @param {ApiRange | ApiName | number} arg2 - The second decimal representation of the binary number to evaluate.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.BITOR = function (arg1, arg2) { return 0; };

/**
 * Returns a number shifted right by the specified number of bits.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The decimal representation of the binary number to evaluate.
 * @param {ApiRange | ApiName | number} arg2 - The number of bits by which the number will be shifted right.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.BITRSHIFT = function (arg1, arg2) { return 0; };

/**
 * Returns a bitwise "XOR" (Exclusive Or) of two numbers.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The first decimal representation of the binary number to evaluate.
 * @param {ApiRange | ApiName | number} arg2 - The second decimal representation of the binary number to evaluate.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.BITXOR = function (arg1, arg2) { return 0; };

/**
 * Converts real and imaginary coefficients into a complex number.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The real coefficient of the complex number.
 * @param {ApiRange | ApiName | number} arg2 - The imaginary coefficient of the complex number.
 * @param {ApiRange | ApiName | string} [arg3] - The suffix for the imaginary component of the complex number. It can be either "i" or "j" in lowercase.
 * If it is omitted, the function will assume suffix to be "i".
 * @returns {number}
 */
ApiWorksheetFunction.prototype.COMPLEX = function (arg1, arg2, arg3) { return 0; };

/**
 * Converts a number from one measurement system to another.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The value in the specified units to be converted.
 * @param {ApiRange | ApiName | string} arg2 - The original measurement unit.
 * @param {ApiRange | ApiName | string} arg3 - The units for the result.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.CONVERT = function (arg1, arg2, arg3) { return 0; };

/**
 * Converts a decimal number to binary.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The decimal integer to convert.
 * @param {ApiRange | ApiName | number} [arg2] - The number of characters to use.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.DEC2BIN = function (arg1, arg2) { return 0; };

/**
 * Converts a decimal number to hexadecimal.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The decimal integer to convert.
 * @param {ApiRange | ApiName | number} [arg2] - The number of characters to use.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.DEC2HEX = function (arg1, arg2) { return 0; };

/**
 * Converts a decimal number to octal.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - Te decimal integer to convert.
 * @param {ApiRange | ApiName | number} [arg2] - The number of characters to use.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.DEC2OCT = function (arg1, arg2) { return 0; };

/**
 * Tests whether two numbers are equal. The function returns 1 if the numbers are equal and 0 otherwise.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The first number.
 * @param {ApiRange | ApiName | number} [arg2] - The second number.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.DELTA = function (arg1, arg2) { return 0; };

/**
 * Returns the error function integrated between the specified lower and upper limits.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The lower bound for integrating the error function.
 * @param {ApiRange | ApiName | number} [arg2] - The upper bound for integrating the error function.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.ERF = function (arg1, arg2) { return 0; };

/**
 * Returns the error function integrated between 0 and the specified lower limit.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The lower bound for integrating the error function.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.ERF_PRECISE = function (arg1) { return 0; };

/**
 * Returns the complementary error function integrated between the specified lower limit and infinity.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The lower bound for integrating the complementary error function.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.ERFC = function (arg1) { return 0; };

/**
 * Returns the complementary error function integrated between the specified lower limit and infinity.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The lower bound for integrating the complementary error function.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.ERFC_PRECISE = function (arg1) { return 0; };

/**
 * Tests whether a number is greater than a threshold value. The function returns 1 if the number is greater than or equal to the threshold value and 0 otherwise.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The value to test against step.
 * @param {ApiRange | ApiName | number} [arg2] - The threshold value.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.GESTEP = function (arg1, arg2) { return 0; };

/**
 * Converts a hexadecimal number to binary.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The hexadecimal number to convert.
 * @param {ApiRange | ApiName | number} [arg2] - The number of characters to use.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.HEX2BIN = function (arg1, arg2) { return 0; };

/**
 * Converts a hexadecimal number to decimal.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The hexadecimal number to convert.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.HEX2DEC = function (arg1) { return 0; };

/**
 * Converts a hexadecimal number to octal.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The hexadecimal number to convert.
 * @param {ApiRange | ApiName | number} [arg2] - The number of characters to use.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.HEX2OCT = function (arg1, arg2) { return 0; };

/**
 * Returns the absolute value (modulus) of a complex number.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - A complex number expressed in the *x + yi* or *x + yj* form.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.IMABS = function (arg1) { return 0; };

/**
 * Returns the imaginary coefficient of a complex number.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - A complex number expressed in the *x + yi* or *x + yj* form.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.IMAGINARY = function (arg1) { return 0; };

/**
 * Returns the argument Theta, an angle expressed in radians.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - A complex number expressed in the *x + yi* or *x + yj* form.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.IMARGUMENT = function (arg1) { return 0; };

/**
 * Returns the complex conjugate of a complex number.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - A complex number expressed in the *x + yi* or *x + yj* form.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.IMCONJUGATE = function (arg1) { return 0; };

/**
 * Returns the cosine of a complex number.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - A complex number expressed in the *x + yi* or *x + yj* form.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.IMCOS = function (arg1) { return 0; };

/**
 * Returns the hyperbolic cosine of a complex number.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - A complex number expressed in the *x + yi* or *x + yj* form.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.IMCOSH = function (arg1) { return 0; };

/**
 * Returns the cotangent of a complex number.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - A complex number expressed in the *x + yi* or *x + yj* form.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.IMCOT = function (arg1) { return 0; };

/**
 * Returns the cosecant of a complex number.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - A complex number expressed in the *x + yi* or *x + yj* form.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.IMCSC = function (arg1) { return 0; };

/**
 * Returns the hyperbolic cosecant of a complex number.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - A complex number expressed in the *x + yi* or *x + yj* form.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.IMCSCH = function (arg1) { return 0; };

/**
 * Returns the quotient of two complex numbers.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The complex numerator or dividend in the *x + yi* or *x + yj* form.
 * @param {ApiRange | ApiName | number} arg2 - The complex denominator or divisor in the *x + yi* or *x + yj* form.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.IMDIV = function (arg1, arg2) { return 0; };

/**
 * Returns the exponential of a complex number.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - A complex number expressed in the *x + yi* or *x + yj* form.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.IMEXP = function (arg1) { return 0; };

/**
 * Returns the natural logarithm of a complex number.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - A complex number expressed in the *x + yi* or *x + yj* form.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.IMLN = function (arg1) { return 0; };

/**
 * Returns the base-10 logarithm of a complex number.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - A complex number expressed in the *x + yi* or *x + yj* form.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.IMLOG10 = function (arg1) { return 0; };

/**
 * Returns the base-2 logarithm of a complex number.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - A complex number expressed in the *x + yi* or *x + yj* form.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.IMLOG2 = function (arg1) { return 0; };

/**
 * Returns a complex number raised to an integer power.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - A complex number expressed in the *x + yi* or *x + yj* form.
 * @param {ApiRange | ApiName | number} arg2 - The power to which the complex number will be raised.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.IMPOWER = function (arg1, arg2) { return 0; };

/**
 * Returns the product of the specified complex numbers.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | string} args - Up to 255 complex numbers expressed in the *x + yi* or *x + yj* form.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.IMPRODUCT = function () { return 0; };

/**
 * Returns the real coefficient of a complex number.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - A complex number expressed in the *x + yi* or *x + yj* form.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.IMREAL = function (arg1) { return 0; };

/**
 * Returns the secant of a complex number.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - A complex number expressed in the *x + yi* or *x + yj* form.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.IMSEC = function (arg1) { return 0; };

/**
 * Returns the hyperbolic secant of a complex number.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - A complex number expressed in the *x + yi* or *x + yj* form.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.IMSECH = function (arg1) { return 0; };

/**
 * Returns the sine of a complex number.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - A complex number expressed in the *x + yi* or *x + yj* form.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.IMSIN = function (arg1) { return 0; };

/**
 * Returns the hyperbolic sine of a complex number.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - A complex number expressed in the *x + yi* or *x + yj* form.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.IMSINH = function (arg1) { return 0; };

/**
 * Returns the square root of a complex number.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - A complex number expressed in the *x + yi* or *x + yj* form.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.IMSQRT = function (arg1) { return 0; };

/**
 * Returns the difference of two complex numbers expressed in the *x + yi* or *x + yj* form.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The complex number from which to subtract the second number.
 * @param {ApiRange | ApiName | number} arg2 - The complex number to subtract from the first number.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.IMSUB = function (arg1, arg2) { return 0; };

/**
 * Returns the sum of the specified complex numbers.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | string} args - Up to 255 complex numbers expressed in the *x + yi* or *x + yj* form.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.IMSUM = function () { return 0; };

/**
 * Returns the tangent of a complex number.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - A complex number expressed in the *x + yi* or *x + yj* form.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.IMTAN = function (arg1) { return 0; };

/**
 * Converts an octal number to binary.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The octal number to convert.
 * @param {ApiRange | ApiName | number} [arg2] - The number of characters to use.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.OCT2BIN = function (arg1, arg2) { return 0; };

/**
 * Converts an octal number to decimal.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The octal number to convert.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.OCT2DEC = function (arg1) { return 0; };

/**
 * Converts an octal number to hexadecimal.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The octal number to convert.
 * @param {ApiRange | ApiName | number} [arg2] -The number of characters to use.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.OCT2HEX = function (arg1, arg2) { return 0; };

/**
 * Averages the values in a field (column) of records in a list or database that match conditions you specify.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName} arg1 - The range of cells that makes up the list or database. A database is a list of related data.
 * @param {ApiRange | ApiName | number | string} arg2 - The column which is used in the function. Either the label of the column in double quotation marks or a number that represents the column's position in the list.
 * @param {ApiRange | ApiName} arg3 - The range of cells that contains the conditions you specify. The range includes at least one column label and at least one cell below the column label for a condition.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.DAVERAGE = function (arg1, arg2, arg3) { return 0; };

/**
 * Counts the cells containing numbers in the field (column) of records in the database that match the conditions you specify.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName} arg1 - The range of cells that makes up the list or database. A database is a list of related data.
 * @param {ApiRange | ApiName | number | string} arg2 - The column which is used in the function. Either the label of the column in double quotation marks or a number that represents the column's position in the list.
 * @param {ApiRange | ApiName} arg3 - The range of cells that contains the conditions you specify. The range includes at least one column label and at least one cell below the column label for a condition.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.DCOUNT = function (arg1, arg2, arg3) { return 0; };

/**
 * Counts nonblank cells in the field (column) of records in the database that match the conditions you specify.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName} arg1- The range of cells that makes up the list or database. A database is a list of related data.
 * @param {ApiRange | ApiName | number | string} arg2 - The column which is used in the function. Either the label of the column in double quotation marks or a number that represents the column's position in the list.
 * @param {ApiRange | ApiName} arg3 - The range of cells that contains the conditions you specify. The range includes at least one column label and at least one cell below the column label for a condition.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.DCOUNTA = function (arg1, arg2, arg3) { return 0; };

/**
 * Extracts from a database a single record that matches the conditions you specify.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName} arg1 - The range of cells that makes up the list or database. A database is a list of related data.
 * @param {ApiRange | ApiName | number | string} arg2 - The column which is used in the function. Either the label of the column in double quotation marks or a number that represents the column's position in the list.
 * @param {ApiRange | ApiName} arg3 - The range of cells that contains the conditions you specify. The range includes at least one column label and at least one cell below the column label for a condition.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.DGET = function (arg1, arg2, arg3) { return 0; };

/**
 * Returns the largest number in the field (column) of records in the database that match the conditions you specify.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName} arg1 - The range of cells that makes up the list or database. A database is a list of related data.
 * @param {ApiRange | ApiName | number | string} arg2 - The column which is used in the function. Either the label of the column in double quotation marks or a number that represents the column's position in the list.
 * @param {ApiRange | ApiName} arg3 - The range of cells that contains the conditions you specify. The range includes at least one column label and at least one cell below the column label for a condition.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.DMAX = function (arg1, arg2, arg3) { return 0; };

/**
 * Returns the smallest number in the field (column) of records in the database that match the conditions you specify.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName} arg1 - The range of cells that makes up the list or database. A database is a list of related data.
 * @param {ApiRange | ApiName | number | string} arg2 - The column which is used in the function. Either the label of the column in double quotation marks or a number that represents the column's position in the list.
 * @param {ApiRange | ApiName} arg3 - The range of cells that contains the conditions you specify. The range includes at least one column label and at least one cell below the column label for a condition.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.DMIN = function (arg1, arg2, arg3) { return 0; };

/**
 * Multiplies the values in the field (column) of records in the database that match the conditions you specify.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName} arg1 - The range of cells that makes up the list or database. A database is a list of related data.
 * @param {ApiRange | ApiName | number | string} arg2 - The column which is used in the function. Either the label of the column in double quotation marks or a number that represents the column's position in the list.
 * @param {ApiRange | ApiName} arg3 - The range of cells that contains the conditions you specify. The range includes at least one column label and at least one cell below the column label for a condition.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.DPRODUCT = function (arg1, arg2, arg3) { return 0; };

/**
 * Estimates the standard deviation based on a sample from the selected database entries.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName} arg1 - The range of cells that makes up the list or database. A database is a list of related data.
 * @param {ApiRange | ApiName | number | string} arg2 - The column which is used in the function. Either the label of the column in double quotation marks or a number that represents the column's position in the list.
 * @param {ApiRange | ApiName} arg3 - The range of cells that contains the conditions you specify. The range includes at least one column label and at least one cell below the column label for a condition.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.DSTDEV = function (arg1, arg2, arg3) { return 0; };

/**
 * Calculates the standard deviation based on the entire population of the selected database entries.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName} arg1 - The range of cells that makes up the list or database. A database is a list of related data.
 * @param {ApiRange | ApiName | number | string} arg2 - The column which is used in the function. Either the label of the column in double quotation marks or a number that represents the column's position in the list.
 * @param {ApiRange | ApiName} arg3 - The range of cells that contains the conditions you specify. The range includes at least one column label and at least one cell below the column label for a condition.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.DSTDEVP = function (arg1, arg2, arg3) { return 0; };

/**
 * Adds the numbers in the field (column) of records in the database that match the conditions you specify.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName} arg1 - The range of cells that makes up the list or database. A database is a list of related data.
 * @param {ApiRange | ApiName | number | string} arg2 - The column which is used in the function. Either the label of the column in double quotation marks or a number that represents the column's position in the list.
 * @param {ApiRange | ApiName} arg3 - The range of cells that contains the conditions you specify. The range includes at least one column label and at least one cell below the column label for a condition.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.DSUM = function (arg1, arg2, arg3) { return 0; };

/**
 * Estimates variance based on a sample from the selected database entries.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName} arg1 - The range of cells that makes up the list or database. A database is a list of related data.
 * @param {ApiRange | ApiName | number | string} arg2 - The column which is used in the function. Either the label of the column in double quotation marks or a number that represents the column's position in the list.
 * @param {ApiRange | ApiName} arg3 - The range of cells that contains the conditions you specify. The range includes at least one column label and at least one cell below the column label for a condition.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.DVAR = function (arg1, arg2, arg3) { return 0; };

/**
 * Calculates variance based on the entire population of the selected database entries.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName} arg1 - The range of cells that makes up the list or database. A database is a list of related data.
 * @param {ApiRange | ApiName | number | string} arg2 - The column which is used in the function. Either the label of the column in double quotation marks or a number that represents the column's position in the list.
 * @param {ApiRange | ApiName} arg3 - The range of cells that contains the conditions you specify. The range includes at least one column label and at least one cell below the column label for a condition.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.DVARP = function (arg1, arg2, arg3) { return 0; };

/**
 * Returns the accrued interest for a security that pays periodic interest.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The issue date of the security, expressed as a serial date number.
 * @param {ApiRange | ApiName | number} arg2 - The date when the first interest is paid, expressed as a serial date number.
 * @param {ApiRange | ApiName | number} arg3 - The security settlement date, expressed as a serial date number.
 * @param {ApiRange | ApiName | number} arg4 - The annual coupon rate of the security.
 * @param {ApiRange | ApiName | number} arg5 - The par value of the security.
 * @param {ApiRange | ApiName | number} arg6 - The number of interest payments per year. The possible values are: 1 for annual payments, 2 for semiannual payments, 4 for quarterly payments.
 * @param {ApiRange | ApiName | number} [arg7] - The day count basis to use: <b>0</b> or omitted - US (NASD) 30/360; <b>1</b> - Actual/actual; <b>2</b> - Actual/360; <b>3</b> - Actual/365; <b>4</b> - European 30/360.
 * @param {ApiRange | ApiName | number} [arg8] - A logical value: <b>true</b> (1) or omitted returns the accrued interest from the issue date to the settlement date.
 * <b>false</b> (0) returns the accrued interest from the first interest date to the settlement date.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.ACCRINT = function (arg1, arg2, arg3, arg4, arg5, arg6, arg7, arg8) { return 0; };

/**
 * Returns the accrued interest for a security that pays interest at maturity.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The issue date of the security, expressed as a serial date number.
 * @param {ApiRange | ApiName | number} arg2 - The maturity date of the security, expressed as a serial date number.
 * @param {ApiRange | ApiName | number} arg3 - The annual coupon rate of the security.
 * @param {ApiRange | ApiName | number} arg4 - The par value of the security.
 * @param {ApiRange | ApiName | number} [arg5] - The day count basis to use: <b>0</b> or omitted - US (NASD) 30/360; <b>1</b> - Actual/actual; <b>2</b> - Actual/360; <b>3</b> - Actual/365; <b>4</b> - European 30/360.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.ACCRINTM = function (arg1, arg2, arg3, arg4, arg5) { return 0; };

/**
 * Returns the prorated linear depreciation of an asset for each accounting period.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The cost of the asset.
 * @param {ApiRange | ApiName | number} arg2 - The date when asset is purchased.
 * @param {ApiRange | ApiName | number} arg3 - The date when the first period ends.
 * @param {ApiRange | ApiName | number} arg4 - The salvage value of the asset at the end of its lifetime.
 * @param {ApiRange | ApiName | number} arg5 - The period for which the depreciation will be calculated.
 * @param {ApiRange | ApiName | number} arg6 - The rate of depreciation.
 * @param {ApiRange | ApiName | number} [arg7] - The day count basis to use: <b>0</b> or omitted - US (NASD) 30/360; <b>1</b> - Actual/actual; <b>2</b> - Actual/360; <b>3</b> - Actual/365; <b>4</b> - European 30/360.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.AMORDEGRC = function (arg1, arg2, arg3, arg4, arg5, arg6, arg7) { return 0; };

/**
 * Returns the prorated linear depreciation of an asset for each accounting period.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The cost of the asset.
 * @param {ApiRange | ApiName | number} arg2 - The date when asset is purchased.
 * @param {ApiRange | ApiName | number} arg3 - The date when the first period ends.
 * @param {ApiRange | ApiName | number} arg4 - The salvage value of the asset at the end of its lifetime.
 * @param {ApiRange | ApiName | number} arg5 - The period for which the depreciation will be calculated.
 * @param {ApiRange | ApiName | number} arg6 - The rate of depreciation.
 * @param {ApiRange | ApiName | number} [arg7] - The day count basis to use: <b>0</b> or omitted - US (NASD) 30/360; <b>1</b> - Actual/actual; <b>2</b> - Actual/360; <b>3</b> - Actual/365; <b>4</b> - European 30/360.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.AMORLINC = function (arg1, arg2, arg3, arg4, arg5, arg6, arg7) { return 0; };

/**
 * Returns the number of days from the beginning of the coupon period to the settlement date.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The security settlement date, expressed as a serial date number.
 * @param {ApiRange | ApiName | number} arg2 - The maturity date of the security, expressed as a serial date number.
 * @param {ApiRange | ApiName | number} arg3 - The number of interest payments per year. The possible values are: 1 for annual payments, 2 for semiannual payments, 4 for quarterly payments.
 * @param {ApiRange | ApiName | number} [arg4] - The day count basis to use: <b>0</b> or omitted - US (NASD) 30/360; <b>1</b> - Actual/actual; <b>2</b> - Actual/360; <b>3</b> - Actual/365; <b>4</b> - European 30/360.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.COUPDAYBS = function (arg1, arg2, arg3, arg4) { return 0; };

/**
 * Returns the number of days in the coupon period that contains the settlement date.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The security settlement date, expressed as a serial date number.
 * @param {ApiRange | ApiName | number} arg2 - The maturity date of the security, expressed as a serial date number.
 * @param {ApiRange | ApiName | number} arg3 - The number of interest payments per year. The possible values are: 1 for annual payments, 2 for semiannual payments, 4 for quarterly payments.
 * @param {ApiRange | ApiName | number} [arg4] - The day count basis to use: <b>0</b> or omitted - US (NASD) 30/360; <b>1</b> - Actual/actual; <b>2</b> - Actual/360; <b>3</b> - Actual/365; <b>4</b> - European 30/360.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.COUPDAYS = function (arg1, arg2, arg3, arg4) { return 0; };

/**
 * Returns the number of days from the settlement date to the next coupon date.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The security settlement date, expressed as a serial date number.
 * @param {ApiRange | ApiName | number} arg2 - The maturity date of the security, expressed as a serial date number.
 * @param {ApiRange | ApiName | number} arg3 - The number of interest payments per year. The possible values are: 1 for annual payments, 2 for semiannual payments, 4 for quarterly payments.
 * @param {ApiRange | ApiName | number} [arg4] - The day count basis to use: <b>0</b> or omitted - US (NASD) 30/360; <b>1</b> - Actual/actual; <b>2</b> - Actual/360; <b>3</b> - Actual/365; <b>4</b> - European 30/360.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.COUPDAYSNC = function (arg1, arg2, arg3, arg4) { return 0; };

/**
 * Returns the next coupon date after the settlement date.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The security settlement date, expressed as a serial date number.
 * @param {ApiRange | ApiName | number} arg2 - The maturity date of the security, expressed as a serial date number.
 * @param {ApiRange | ApiName | number} arg3 - The number of interest payments per year. The possible values are: 1 for annual payments, 2 for semiannual payments, 4 for quarterly payments.
 * @param {ApiRange | ApiName | number} [arg4] - The day count basis to use: <b>0</b> or omitted - US (NASD) 30/360; <b>1</b> - Actual/actual; <b>2</b> - Actual/360; <b>3</b> - Actual/365; <b>4</b> - European 30/360.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.COUPNCD = function (arg1, arg2, arg3, arg4) { return 0; };

/**
 * Returns the number of coupons payable between the settlement date and maturity date.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The security settlement date, expressed as a serial date number.
 * @param {ApiRange | ApiName | number} arg2 - The maturity date of the security, expressed as a serial date number.
 * @param {ApiRange | ApiName | number} arg3 - The number of interest payments per year. The possible values are: 1 for annual payments, 2 for semiannual payments, 4 for quarterly payments.
 * @param {ApiRange | ApiName | number} [arg4] - The day count basis to use: <b>0</b> or omitted - US (NASD) 30/360; <b>1</b> - Actual/actual; <b>2</b> - Actual/360; <b>3</b> - Actual/365; <b>4</b> - European 30/360.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.COUPNUM = function (arg1, arg2, arg3, arg4) { return 0; };

/**
 * Returns the previous coupon date before the settlement date.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The security settlement date, expressed as a serial date number.
 * @param {ApiRange | ApiName | number} arg2 - The maturity date of the security, expressed as a serial date number.
 * @param {ApiRange | ApiName | number} arg3 - The number of interest payments per year. The possible values are: 1 for annual payments, 2 for semiannual payments, 4 for quarterly payments.
 * @param {ApiRange | ApiName | number} [arg4] - The day count basis to use: <b>0</b> or omitted - US (NASD) 30/360; <b>1</b> - Actual/actual; <b>2</b> - Actual/360; <b>3</b> - Actual/365; <b>4</b> - European 30/360.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.COUPPCD = function (arg1, arg2, arg3, arg4) { return 0; };

/**
 * Returns the cumulative interest paid between two periods.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The interest rate for the investment.
 * @param {ApiRange | ApiName | number} arg2 - The total number of payment periods.
 * @param {ApiRange | ApiName | number} arg3 - A present value of the payments.
 * @param {ApiRange | ApiName | number} arg4 - The first period included into the calculation.
 * @param {ApiRange | ApiName | number} arg5 - The last period included into the calculation.
 * @param {ApiRange | ApiName | number} arg6 - The timing of the payment.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.CUMIPMT = function (arg1, arg2, arg3, arg4, arg5, arg6) { return 0; };

/**
 * Returns the cumulative principal paid on a loan between two periods.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The interest rate for the investment.
 * @param {ApiRange | ApiName | number} arg2 - The total number of payment periods.
 * @param {ApiRange | ApiName | number} arg3 - A present value of the payments.
 * @param {ApiRange | ApiName | number} arg4 - The first period included into the calculation.
 * @param {ApiRange | ApiName | number} arg5 - The last period included into the calculation.
 * @param {ApiRange | ApiName | number} arg6 - The timing of the payment.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.CUMPRINC = function (arg1, arg2, arg3, arg4, arg5, arg6) { return 0; };

/**
 * Returns the depreciation of an asset for a specified period using the fixed-declining balance method.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The initial cost of the asset.
 * @param {ApiRange | ApiName | number} arg2 - The salvage value of the asset at the end of its lifetime.
 * @param {ApiRange | ApiName | number} arg3 - The number of periods over which the asset is being depreciated (sometimes called the useful life of the asset).
 * @param {ApiRange | ApiName | number} arg4 - The period for which the depreciation will be calculated. Period must use the same units as the useful life of the asset.
 * @param {ApiRange | ApiName | number} [arg5] - The number of months in the first year. If this parameter is omitted, it is assumed to be 12.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.DB = function (arg1, arg2, arg3, arg4, arg5) { return 0; };

/**
 * Returns the depreciation of an asset for a specified period using the double-declining balance method or some other method you specify.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The initial cost of the asset.
 * @param {ApiRange | ApiName | number} arg2 - The salvage value of the asset at the end of its lifetime.
 * @param {ApiRange | ApiName | number} arg3 - The number of periods over which the asset is being depreciated (sometimes called the useful life of the asset).
 * @param {ApiRange | ApiName | number} arg4 - The period for which the depreciation will be calculated. Period must use the same units as the useful life of the asset.
 * @param {ApiRange | ApiName | number} [arg5] - The rate at which the balance declines. If this parameter is omitted, it is assumed to be 2 (the double-declining balance method).
 * @returns {number}
 */
ApiWorksheetFunction.prototype.DDB = function (arg1, arg2, arg3, arg4, arg5) { return 0; };

/**
 * Returns the discount rate for a security.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The security settlement date, expressed as a serial date number.
 * @param {ApiRange | ApiName | number} arg2 - The maturity date of the security, expressed as a serial date number.
 * @param {ApiRange | ApiName | number} arg3 - The purchase price of the security, per $100 par value.
 * @param {ApiRange | ApiName | number} arg4 - The redemption value of the security, per $100 par value.
 * @param {ApiRange | ApiName | number} [arg5] - The day count basis to use: <b>0</b> or omitted - US (NASD) 30/360; <b>1</b> - Actual/actual; <b>2</b> - Actual/360; <b>3</b> - Actual/365; <b>4</b> - European 30/360.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.DISC = function (arg1, arg2, arg3, arg4, arg5) { return 0; };

/**
 * Converts a dollar price, expressed as a fraction, into a dollar price, expressed as a decimal number.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - A number expressed as a fraction.
 * @param {ApiRange | ApiName | number} arg2 - The integer to use in the denominator of the fraction.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.DOLLARDE = function (arg1, arg2) { return 0; };

/**
 * Converts a dollar price, expressed as a decimal number, into a dollar price, expressed as a fraction.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - A decimal number.
 * @param {ApiRange | ApiName | number} arg2 - The integer to use in the denominator of a fraction.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.DOLLARFR = function (arg1, arg2) { return 0; };

/**
 * Returns the annual duration of a security with periodic interest payments.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The security settlement date, expressed as a serial date number.
 * @param {ApiRange | ApiName | number} arg2 - The maturity date of the security, expressed as a serial date number.
 * @param {ApiRange | ApiName | number} arg3 - The annual coupon rate of the security.
 * @param {ApiRange | ApiName | number} arg4 - The annual yield of the security.
 * @param {ApiRange | ApiName | number} arg5 - The number of interest payments per year. The possible values are: 1 for annual payments, 2 for semiannual payments, 4 for quarterly payments.
 * @param {ApiRange | ApiName | number} [arg6] - The day count basis to use: <b>0</b> or omitted - US (NASD) 30/360; <b>1</b> - Actual/actual; <b>2</b> - Actual/360; <b>3</b> - Actual/365; <b>4</b> - European 30/360.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.DURATION = function (arg1, arg2, arg3, arg4, arg5, arg6) { return 0; };

/**
 * Returns the effective annual interest rate.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The nominal interest rate.
 * @param {ApiRange | ApiName | number} arg2 - The number of compounding periods per year.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.EFFECT = function (arg1, arg2) { return 0; };

/**
 * Returns the future value of an investment based on periodic, constant payments and a constant interest rate.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The interest rate per period. For example, use 6%/4 for quarterly payments at 6% APR.
 * @param {ApiRange | ApiName | number} arg2 - The total number of payment periods in the investment.
 * @param {ApiRange | ApiName | number} arg3 - The payment made each period; it cannot change over the life of the investment.
 * @param {ApiRange | ApiName | number} [arg4] - The present value, or the lump-sum amount that a series of future payments is worth now. If omitted, it is equal to 0.
 * @param {ApiRange | ApiName | number} [arg5] - A value representing the timing of payment: payment at the beginning of the period = 1; payment at the end of the period = 0 or omitted.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.FV = function (arg1, arg2, arg3, arg4, arg5) { return 0; };

/**
 * Returns the future value of an initial principal after applying a series of compound interest rates.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The present value of an investment.
 * @param {number[] | ApiRange | ApiName} arg2 - An array of interest rates to apply.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.FVSCHEDULE = function (arg1, arg2) { return 0; };

/**
 * Returns the interest rate for a fully invested security.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The security settlement date, expressed as a serial date number.
 * @param {ApiRange | ApiName | number} arg2 - The maturity date of the security, expressed as a serial date number.
 * @param {ApiRange | ApiName | number} arg3 - The amount invested in the security.
 * @param {ApiRange | ApiName | number} arg4 - The amount to be received at maturity.
 * @param {ApiRange | ApiName | number} [arg6] - The day count basis to use: <b>0</b> or omitted - US (NASD) 30/360; <b>1</b> - Actual/actual; <b>2</b> - Actual/360; <b>3</b> - Actual/365; <b>4</b> - European 30/360.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.INTRATE = function (arg1, arg2, arg3, arg4, arg5) { return 0; };

/**
 * Returns the interest payment for a given period for an investment, based on periodic, constant payments and a constant interest rate.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The interest rate per period. For example, use 6%/4 for quarterly payments at 6% APR.
 * @param {ApiRange | ApiName | number} arg2 - The period for which the interest will be returned. It must be in the range from 1 to the total number of payments.
 * @param {ApiRange | ApiName | number} arg3 - The total number of payment periods in an investment.
 * @param {ApiRange | ApiName | number} arg4 - The present value, or the lump-sum amount that a series of future payments is worth now.
 * @param {ApiRange | ApiName | number} [arg5] - The future value, or a cash balance which will be attained after the last payment is made. If omitted, it is equal to 0.
 * @param {ApiRange | ApiName | number} [arg6] - A logical value representing the timing of payment: at the end of the period = 0 or omitted, at the beginning of the period = 1.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.IPMT = function (arg1, arg2, arg3, arg4, arg5, arg6) { return 0; };

/**
 * Returns the internal rate of return for a series of cash flows.
 * @memberof ApiWorksheetFunction
 * @param {number[] | ApiRange} arg1 - A range or array of cells that contain numbers for which the internal rate of return will be calculated.
 * @param {ApiRange | ApiName | number} [arg2] - An estimate at what the internal rate of return will be. If it is omitted, the function will assume guess to be 0.1 (10 percent).
 * @returns {number}
 */
ApiWorksheetFunction.prototype.IRR = function (arg1, arg2) { return 0; };

/**
 * Returns the interest paid during a specific period of an investment.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The interest rate per period. For example, use 6%/4 for quarterly payments at 6% APR.
 * @param {ApiRange | ApiName | number} arg2 - The period for which the interest will be retuned. It must be in the range from 1 to the total number of payments.
 * @param {ApiRange | ApiName | number} arg3 - The total number of payment periods in an investment.
 * @param {ApiRange | ApiName | number} arg4 - The present value, or the lump-sum amount that a series of future payments is worth now.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.ISPMT = function (arg1, arg2, arg3, arg4) { return 0; };

/**
 * Returns the modified Macauley duration of a security with an assumed par value of $100.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The security settlement date, expressed as a serial date number.
 * @param {ApiRange | ApiName | number} arg2 - The maturity date of the security, expressed as a serial date number.
 * @param {ApiRange | ApiName | number} arg3 - The annual coupon rate of the security.
 * @param {ApiRange | ApiName | number} arg4 - The annual yield of the security.
 * @param {ApiRange | ApiName | number} arg5 - The number of interest payments per year. The possible values are: 1 for annual payments, 2 for semiannual payments, 4 for quarterly payments.
 * @param {ApiRange | ApiName | number} [arg6] - The day count basis to use: <b>0</b> or omitted - US (NASD) 30/360; <b>1</b> - Actual/actual; <b>2</b> - Actual/360; <b>3</b> - Actual/365; <b>4</b> - European 30/360.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.MDURATION = function (arg1, arg2, arg3, arg4, arg5, arg6) { return 0; };

/**
 * Returns the internal rate of return for a series of periodic cash flows, considering both cost of investment and interest on reinvestment of cash.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number[]} arg1 - A range or array of cells that contain numbers that represent a series of payments (negative) and income (positive) at regular periods.
 * @param {ApiRange | ApiName | number} arg2 - The interest rate paid on the money used in the cash flows.
 * @param {ApiRange | ApiName | number} arg3 - The interest rate received on the cash reinvestment.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.MIRR = function (arg1, arg2, arg3) { return 0; };

/**
 * Returns the annual nominal interest rate.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The effective interest rate of the security.
 * @param {ApiRange | ApiName | number} arg2 - The number of compounding periods per year.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.NOMINAL = function (arg1, arg2) { return 0; };

/**
 * Returns the number of periods for an investment based on periodic, constant payments and a constant interest rate.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The interest rate per period. For example, use 6%/4 for quarterly payments at 6% APR.
 * @param {ApiRange | ApiName | number} arg2 - The payment made each period; it cannot change over the life of the investment.
 * @param {ApiRange | ApiName | number} arg3 - Te present value, or the lump-sum amount that a series of future payments is worth now.
 * @param {ApiRange | ApiName | number} [arg4] - The future value, or a cash balance which will be attained after the last payment is made. If omitted, zero is used.
 * @param {ApiRange | ApiName | number} [arg5] - A logical value: payment at the beginning of the period = 1; payment at the end of the period = 0 or omitted.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.NPER = function (arg1, arg2, arg3, arg4, arg5) { return 0; };

/**
 * Returns the net present value of an investment based on a discount rate and a series of future payments (negative values) and income (positive values).
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The discount rate.
 * @param {number | ApiRange | number[]} args - Up to 255 arguments representing future payments (negative values) and income (positive values).
 * The first argument is required, the subsequent values are optional. Arguments can be numbers, ranges, arrays of numbers.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.NPV = function () { return 0; };

/**
 * Returns the price per $100 face value of a security with an odd first period.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The security settlement date, expressed as a serial date number.
 * @param {ApiRange | ApiName | number} arg2 - The maturity date of the security, expressed as a serial date number.
 * @param {ApiRange | ApiName | number} arg3 - The issue date of the security, expressed as a serial date number.
 * @param {ApiRange | ApiName | number} arg4 - The first coupon date of the security, expressed as a serial date number.
 * @param {ApiRange | ApiName | number} arg5 - The interest rate of the security.
 * @param {ApiRange | ApiName | number} arg6 - The annual yield of the security.
 * @param {ApiRange | ApiName | number} arg7 - The redemption value of the security, per $100 face value.
 * @param {ApiRange | ApiName | number} arg8 - The number of interest payments per year. The possible values are: 1 for annual payments, 2 for semiannual payments, 4 for quarterly payments.
 * @param {ApiRange | ApiName | number} [arg9] - The day count basis to use: <b>0</b> or omitted - US (NASD) 30/360; <b>1</b> - Actual/actual; <b>2</b> - Actual/360; <b>3</b> - Actual/365; <b>4</b> - European 30/360.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.ODDFPRICE = function (arg1, arg2, arg3, arg4, arg5, arg6, arg7, arg8, arg9) { return 0; };

/**
 * Returns the yield of a security with an odd first period.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The security settlement date, expressed as a serial date number.
 * @param {ApiRange | ApiName | number} arg2 - The maturity date of the security, expressed as a serial date number.
 * @param {ApiRange | ApiName | number} arg3 - The issue date of the security, expressed as a serial date number.
 * @param {ApiRange | ApiName | number} arg4 - The first coupon date of the security, expressed as a serial date number.
 * @param {ApiRange | ApiName | number} arg5 - The interest rate of the security.
 * @param {ApiRange | ApiName | number} arg6 - The purchase price of the security, per $100 par value.
 * @param {ApiRange | ApiName | number} arg7 - The redemption value of the security, per $100 par value.
 * @param {ApiRange | ApiName | number} arg8 - The number of interest payments per year. The possible values are: 1 for annual payments, 2 for semiannual payments, 4 for quarterly payments.
 * @param {ApiRange | ApiName | number} [arg9] - The day count basis to use: <b>0</b> or omitted - US (NASD) 30/360; <b>1</b> - Actual/actual; <b>2</b> - Actual/360; <b>3</b> - Actual/365; <b>4</b> - European 30/360.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.ODDFYIELD = function (arg1, arg2, arg3, arg4, arg5, arg6, arg7, arg8, arg9) { return 0; };

/**
 * Returns the price per $100 face value of a security with an odd last period.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The security settlement date, expressed as a serial date number.
 * @param {ApiRange | ApiName | number} arg2 - The maturity date of the security, expressed as a serial date number.
 * @param {ApiRange | ApiName | number} arg3 - The last coupon date of the security, expressed as a serial date number.
 * @param {ApiRange | ApiName | number} arg5 - The interest rate of the security.
 * @param {ApiRange | ApiName | number} arg5 - The annual yield of the security.
 * @param {ApiRange | ApiName | number} arg6 - The redemption value of the security, per $100 par value.
 * @param {ApiRange | ApiName | number} arg8 - The number of interest payments per year. The possible values are: 1 for annual payments, 2 for semiannual payments, 4 for quarterly payments.
 * @param {ApiRange | ApiName | number} [arg9] - The day count basis to use: <b>0</b> or omitted - US (NASD) 30/360; <b>1</b> - Actual/actual; <b>2</b> - Actual/360; <b>3</b> - Actual/365; <b>4</b> - European 30/360.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.ODDLPRICE = function (arg1, arg2, arg3, arg4, arg5, arg6, arg7, arg8) { return 0; };

/**
 * Returns the yield of a security with an odd last period.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The security settlement date, expressed as a serial date number.
 * @param {ApiRange | ApiName | number} arg2 - The maturity date of the security, expressed as a serial date number.
 * @param {ApiRange | ApiName | number} arg3 - The last coupon date of the security, expressed as a serial date number.
 * @param {ApiRange | ApiName | number} arg5 - The interest rate of the security.
 * @param {ApiRange | ApiName | number} arg6 - The purchase price of the security, per $100 par value.
 * @param {ApiRange | ApiName | number} arg6 - The redemption value of the security, per $100 par value.
 * @param {ApiRange | ApiName | number} arg8 - The number of interest payments per year. The possible values are: 1 for annual payments, 2 for semiannual payments, 4 for quarterly payments.
 * @param {ApiRange | ApiName | number} [arg9] - The day count basis to use: <b>0</b> or omitted - US (NASD) 30/360; <b>1</b> - Actual/actual; <b>2</b> - Actual/360; <b>3</b> - Actual/365; <b>4</b> - European 30/360.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.ODDLYIELD = function (arg1, arg2, arg3, arg4, arg5, arg6, arg7, arg8) { return 0; };

/**
 * Returns the number of periods required by an investment to reach a specified value.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The interest rate per period.
 * @param {ApiRange | ApiName | number} arg2 - The present value of the investment.
 * @param {ApiRange | ApiName | number} arg3 - The desired future value of the investment.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.PDURATION = function (arg1, arg2, arg3) { return 0; };

/**
 * Calculates the payment for a loan based on constant payments and a constant interest rate.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The interest rate per period for the loan. For example, use 6%/4 for quarterly payments at 6% APR.
 * @param {ApiRange | ApiName | number} arg2 - The total number of payments for the loan.
 * @param {ApiRange | ApiName | number} arg3 - The present value: the total amount that a series of future payments is worth now.
 * @param {ApiRange | ApiName | number} [arg4] - The future value, or a cash balance which will be attained after the last payment is made. If omitted, it is equal to 0.
 * @param {ApiRange | ApiName | number} [arg5] - A logical value: payment at the beginning of the period = 1; payment at the end of the period = 0 or omitted.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.PMT = function (arg1, arg2, arg3, arg4, arg5) { return 0; };

/**
 * Returns the payment on the principal for a given investment based on periodic, constant payments and a constant interest rate.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The interest rate per period. For example, use 6%/4 for quarterly payments at 6% APR.
 * @param {ApiRange | ApiName | number} arg2 - The period for which the principal payment will be returned. It must be in the range from 1 to to the total number of payment periods.
 * @param {ApiRange | ApiName | number} arg3 - The total number of payment periods in an investment.
 * @param {ApiRange | ApiName | number} arg4 - The present value: the total amount that a series of future payments is worth now.
 * @param {ApiRange | ApiName | number} [arg5] - The future value, or cash balance which will be attained after the last payment is made.
 * @param {ApiRange | ApiName | number} [arg6] - A logical value: payment at the beginning of the period = 1; payment at the end of the period = 0 or omitted.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.PPMT = function (arg1, arg2, arg3, arg4, arg5, arg6) { return 0; };

/**
 * Returns the price per $100 face value for a security that pays periodic interest.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The security settlement date, expressed as a serial date number.
 * @param {ApiRange | ApiName | number} arg2 - The maturity date of the security, expressed as a serial date number.
 * @param {ApiRange | ApiName | number} arg3 - The annual coupon rate of the security.
 * @param {ApiRange | ApiName | number} arg4 - The annual yield of the security.
 * @param {ApiRange | ApiName | number} arg5 - The redemption value of the security, per $100 par value.
 * @param {ApiRange | ApiName | number} arg6 - The number of interest payments per year. The possible values are: 1 for annual payments, 2 for semiannual payments, 4 for quarterly payments.
 * @param {ApiRange | ApiName | number} [arg7] - The day count basis to use: <b>0</b> or omitted - US (NASD) 30/360; <b>1</b> - Actual/actual; <b>2</b> - Actual/360; <b>3</b> - Actual/365; <b>4</b> - European 30/360.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.PRICE = function (arg1, arg2, arg3, arg4, arg5, arg6, arg7) { return 0; };

/**
 * Returns the price per $100 face value for a discounted security.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The security settlement date, expressed as a serial date number.
 * @param {ApiRange | ApiName | number} arg2 - The maturity date of the security, expressed as a serial date number.
 * @param {ApiRange | ApiName | number} arg3 - The discount rate of the security.
 * @param {ApiRange | ApiName | number} arg4 - The redemption value of the security, per $100 par value.
 * @param {ApiRange | ApiName | number} [arg5] - The day count basis to use: <b>0</b> or omitted - US (NASD) 30/360; <b>1</b> - Actual/actual; <b>2</b> - Actual/360; <b>3</b> - Actual/365; <b>4</b> - European 30/360.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.PRICEDISC = function (arg1, arg2, arg3, arg4, arg5) { return 0; };

/**
 * Returns the price per $100 face value for a security that pays interest at maturity.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The security settlement date, expressed as a serial date number.
 * @param {ApiRange | ApiName | number} arg2 - The maturity date of the security, expressed as a serial date number.
 * @param {ApiRange | ApiName | number} arg3 - The issue date of the security, expressed as a serial date number.
 * @param {ApiRange | ApiName | number} arg4 - The security interest rate at the issue date.
 * @param {ApiRange | ApiName | number} arg5 - The annual yield of the security.
 * @param {ApiRange | ApiName | number} [arg6] - The day count basis to use: <b>0</b> or omitted - US (NASD) 30/360; <b>1</b> - Actual/actual; <b>2</b> - Actual/360; <b>3</b> - Actual/365; <b>4</b> - European 30/360.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.PRICEMAT = function (arg1, arg2, arg3, arg4, arg5, arg6) { return 0; };

/**
 * Returns the present value of an investment: the total amount that a series of future payments is worth now.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The interest rate per period. For example, use 6%/4 for quarterly payments at 6% APR.
 * @param {ApiRange | ApiName | number} arg2 - The total number of payment periods in an investment.
 * @param {ApiRange | ApiName | number} arg3 - The payment made each period and cannot change over the life of the investment.
 * @param {ApiRange | ApiName | number} [arg4] - The future value, or a cash balance which will be attained after the last payment is made. If omitted, it is equal to 0.
 * @param {ApiRange | ApiName | number} [arg5] - A logical value: payment at the beginning of the period = 1; payment at the end of the period = 0 or omitted.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.PV = function (arg1, arg2, arg3, arg4, arg5) { return 0; };

/**
 * Returns the interest rate per period for a loan or an investment. For example, use 6%/4 for quarterly payments at 6% APR.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The total number of payment periods for the loan or investment.
 * @param {ApiRange | ApiName | number} arg2 - The payment made each period and cannot change over the life of the loan or investment.
 * @param {ApiRange | ApiName | number} arg3 - The present value: the total amount that a series of future payments is worth now.
 * @param {ApiRange | ApiName | number} [arg4] - The future value, or a cash balance which will be attained after the last payment is made. If omitted, it is equal to 0.
 * @param {ApiRange | ApiName | number} [arg5] - A logical value: payment at the beginning of the period = 1; payment at the end of the period = 0 or omitted.
 * @param {ApiRange | ApiName | number} [arg6] - An estimate at what the rate will be. If it is omitted, the function will assume guess to be 0.1 (10 percent).
 * @returns {number}
 */
ApiWorksheetFunction.prototype.RATE = function (arg1, arg2, arg3, arg4, arg5, arg6) { return 0; };

/**
 * Returns the amount received at maturity for a fully invested security.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The security settlement date, expressed as a serial date number.
 * @param {ApiRange | ApiName | number} arg2 - The maturity date of the security, expressed as a serial date number.
 * @param {ApiRange | ApiName | number} arg3 - The amount invested in the security.
 * @param {ApiRange | ApiName | number} arg4 - The security discount rate.
 * @param {ApiRange | ApiName | number} [arg6] - The day count basis to use: <b>0</b> or omitted - US (NASD) 30/360; <b>1</b> - Actual/actual; <b>2</b> - Actual/360; <b>3</b> - Actual/365; <b>4</b> - European 30/360.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.RECEIVED = function (arg1, arg2, arg3, arg4, arg5) { return 0; };

/**
 * Returns an equivalent interest rate for the growth of an investment.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The number of periods for the investment.
 * @param {ApiRange | ApiName | number} arg2 - The present value of the investment.
 * @param {ApiRange | ApiName | number} arg3 - The future value of the investment.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.RRI = function (arg1, arg2, arg3) { return 0; };

/**
 * Returns the straight-line depreciation of an asset for one period.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The initial cost of the asset.
 * @param {ApiRange | ApiName | number} arg2 - The salvage value of the asset at the end of its lifetime.
 * @param {ApiRange | ApiName | number} arg3 - The number of periods over which the asset is being depreciated (sometimes called the useful life of the asset).
 * @returns {number}
 */
ApiWorksheetFunction.prototype.SLN = function (arg1, arg2, arg3) { return 0; };

/**
 * Returns the sum-of-years' digits depreciation of an asset for a specified period.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The initial cost of the asset.
 * @param {ApiRange | ApiName | number} arg2 - The salvage value of the asset at the end of its lifetime.
 * @param {ApiRange | ApiName | number} arg3 - The number of periods over which the asset is being depreciated (sometimes called the useful life of the asset).
 * @param {ApiRange | ApiName | number} arg4 - The period for which the depreciation will be calculated. It must use the same units as the useful life of the asset.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.SYD = function (arg1, arg2, arg3, arg4) { return 0; };

/**
 * Returns the bond-equivalent yield for a treasury bill.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The settlement date of the Treasury bill, expressed as a serial date number.
 * @param {ApiRange | ApiName | number} arg2 - The maturity date of the Treasury bill, expressed as a serial date number.
 * @param {ApiRange | ApiName | number} arg3 - The discount rate of the Treasury bill.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.TBILLEQ = function (arg1, arg2, arg3) { return 0; };

/**
 * Returns the price per $100 face value for a Treasury bill.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The settlement date of the Treasury bill, expressed as a serial date number.
 * @param {ApiRange | ApiName | number} arg2 - The maturity date of the Treasury bill, expressed as a serial date number.
 * @param {ApiRange | ApiName | number} arg3 - The discount rate of the Treasury bill.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.TBILLPRICE = function (arg1, arg2, arg3) { return 0; };

/**
 * Returns the yield for a Treasury bill.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The settlement date of the Treasury bill, expressed as a serial date number.
 * @param {ApiRange | ApiName | number} arg2 - The maturity date of the Treasury bill, expressed as a serial date number.
 * @param {ApiRange | ApiName | number} arg3 - The purchase price of the Treasury bill, per $100 par value.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.TBILLYIELD = function (arg1, arg2, arg3) { return 0; };

/**
 * Returns the depreciation of an asset for any specified period, including partial periods, using the double-declining balance method or some other method specified.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The initial cost of the asset.
 * @param {ApiRange | ApiName | number} arg2 - The salvage value of the asset at the end of its lifetime.
 * @param {ApiRange | ApiName | number} arg3 - The number of periods over which the asset is being depreciated (sometimes called the useful life of the asset).
 * @param {ApiRange | ApiName | number} arg4 - The starting period for which the depreciation will be calculated, in the same units as the useful life of the asset.
 * @param {ApiRange | ApiName | number} arg5 - The ending period for which the depreciation will be calculated, in the same units as the useful life of the asset.
 * @param {ApiRange | ApiName | number} [arg6] - The rate at which the balance declines. If it is omitted, the function will assume it to be 2
 * @param {ApiRange | ApiName | boolean} [arg7] - Specifies whether to use straight-line depreciation when depreciation is greater than the declining balance calculation (<b>false</b> or omitted).
 * If it is set to <b>true</b>, the function uses the declining balance method.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.VDB = function (arg1, arg2, arg3, arg4, arg5, arg6, arg7) { return 0; };

/**
 * Returns the internal rate of return for a schedule of cash flows.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName} arg1 - A range that contains the series of cash flows that corresponds to a schedule of payments in dates.
 * @param {ApiRange | ApiName} arg2 - A range that contains the schedule of payment dates that corresponds to the cash flow payments.
 * @param {ApiRange | ApiName | number} [arg3] - An estimate at what the internal rate of return will be. If it is omitted, the function will assume guess to be 0.1 (10 percent).
 * @returns {number}
 */
ApiWorksheetFunction.prototype.XIRR = function (arg1, arg2, arg3) { return 0; };

/**
 * Returns the net present value for a schedule of cash flows.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The discount rate to apply to the cash flows.
 * @param {ApiRange | ApiName} arg2 - A range that contains the series of cash flows that corresponds to a schedule of payments in dates.
 * @param {ApiRange | ApiName} arg3 - A range that contains the schedule of payment dates that corresponds to the cash flow payments.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.XNPV = function (arg1, arg2, arg3) { return 0; };

/**
 * Returns the yield on a security that pays periodic interest.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The settlement date of the Treasury bill, expressed as a serial date number.
 * @param {ApiRange | ApiName | number} arg2 - The maturity date of the Treasury bill, expressed as a serial date number.
 * @param {ApiRange | ApiName | number} arg3 - The annual coupon rate of the security.
 * @param {ApiRange | ApiName | number} arg4 - The purchase price of the security, per $100 par value.
 * @param {ApiRange | ApiName | number} arg5 - The redemption value of the security, per $100 par value.
 * @param {ApiRange | ApiName | number} arg6 - The number of interest payments per year. The possible values are: 1 for annual payments, 2 for semiannual payments, 4 for quarterly payments.
 * @param {ApiRange | ApiName | number} [arg7] - The day count basis to use: <b>0</b> or omitted - US (NASD) 30/360; <b>1</b> - Actual/actual; <b>2</b> - Actual/360; <b>3</b> - Actual/365; <b>4</b> - European 30/360.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.YIELD = function (arg1, arg2, arg3, arg4, arg5, arg6, arg7) { return 0; };

/**
 * Returns the annual yield for a discounted security. For example, a Treasury bill.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The settlement date of the Treasury bill, expressed as a serial date number.
 * @param {ApiRange | ApiName | number} arg2 - The maturity date of the Treasury bill, expressed as a serial date number.
 * @param {ApiRange | ApiName | number} arg3 - The purchase price of the security, per $100 par value.
 * @param {ApiRange | ApiName | number} arg4 - The redemption value of the security, per $100 par value.
 * @param {ApiRange | ApiName | number} [arg5] - The day count basis to use: <b>0</b> or omitted - US (NASD) 30/360; <b>1</b> - Actual/actual; <b>2</b> - Actual/360; <b>3</b> - Actual/365; <b>4</b> - European 30/360.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.YIELDDISC = function (arg1, arg2, arg3, arg4, arg5) { return 0; };

/**
 * Returns the annual yield of a security that pays interest at maturity.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The settlement date of the Treasury bill, expressed as a serial date number.
 * @param {ApiRange | ApiName | number} arg2 - The maturity date of the Treasury bill, expressed as a serial date number.
 * @param {ApiRange | ApiName | number} arg3 - The issue date of the security, expressed as a serial date number.
 * @param {ApiRange | ApiName | number} arg4 - The interest rate of the security at the issue date.
 * @param {ApiRange | ApiName | number} arg5 - The purchase price of the security, per $100 par value.
 * @param {ApiRange | ApiName | number} [arg6] - The day count basis to use: <b>0</b> or omitted - US (NASD) 30/360; <b>1</b> - Actual/actual; <b>2</b> - Actual/360; <b>3</b> - Actual/365; <b>4</b> - European 30/360.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.YIELDMAT = function (arg1, arg2, arg3, arg4, arg5, arg6) { return 0; };

/**
 * Returns the absolute value of a number, a number without its sign.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The real number for which the absolute value will be returned.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.ABS = function (arg1) { return 0; };

/**
 * Returns the arccosine of a number, in radians in the range from 0 to Pi. The arccosine is the angle whose cosine is a number specified in the parameters.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The angle cosine. It must be from -1 to 1.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.ACOS = function (arg1) { return 0; };

/**
 * Returns the inverse hyperbolic cosine of a number.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - Any real number equal to or greater than 1.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.ACOSH = function (arg1) { return 0; };

/**
 * Returns the arccotangent of a number, in radians in the range from 0 to Pi.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The angle cotangent.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.ACOT = function (arg1) { return 0; };

/**
 * Returns the inverse hyperbolic cotangent of a number.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The angle hyperbolic cotangent. It must be less than -1 or greater than 1.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.ACOTH = function (arg1) { return 0; };

/**
 * Returns an aggregate in a list or database.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - A numeric value that specifies which function to use: <b>1</b> - AVERAGE, <b>2</b> - COUNT, <b>3</b> - COUNTA, <b>4</b> - MAX, <b>5</b> - MIN,
 * <b>6</b> - PRODUCT, <b>7</b> - STDEV.S, <b>8</b> - STDEV.P, <b>9</b> - SUM, <b>10</b> - VAR.S, <b>11</b> - VAR.P, <b>12</b> - MEDIAN, <b>13</b> - MODE.SNGL, <b>14</b> - LARGE,
 * <b>15</b> - SMALL, <b>16</b> - PERCENTILE.INC, <b>17</b> - QUARTILE.INC, <b>18</b> - PERCENTILE.EXC, <b>19</b> - QUARTILE.EXC.
 * @param {ApiRange | ApiName | number} arg2 - A numeric value that specifies which values should be ignored: <b>0</b> or omitted - nested SUBTOTAL and AGGREGATE functions,
 * <b>1</b> - hidden rows, nested SUBTOTAL and AGGREGATE functions, <b>2</b> - error values, nested SUBTOTAL and AGGREGATE functions,
 * <b>3</b> - hidden rows, error values, nested SUBTOTAL and AGGREGATE functions, <b>4</b> - nothing, <b>5</b> - hidden rows, <b>6</b> - error values, <b>7</b> - hidden rows and error values.
 * @param {number | ApiRange | number[]} arg3 - The first numeric value for which the aggregate value will be returned.
 * @param {number | ApiRange | number[]} args - Up to 253 numeric values or a range of cells containing the values for which the aggregate value will be returned.
 * Arguments can be numbers, ranges, or arrays of numbers.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.AGGREGATE = function () { return 0; };

/**
 * Converts a Roman numeral to Arabic.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | string} arg1 - The Roman numeral to convert.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.ARABIC = function (arg1) { return 0; };

/**
 * Returns the arcsine of a number in radians, in the range from *-Pi/2* to *Pi/2*.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The angle sine. It must be from -1 to 1.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.ASIN = function (arg1) { return 0; };

/**
 * Returns the inverse hyperbolic sine of a number.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - Any real number equal to or greater than 1.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.ASINH = function (arg1) { return 0; };

/**
 * Returns the arctangent of a number in radians, in the range from *-Pi/2* to *Pi/2*.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The angle tangent.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.ATAN = function (arg1) { return 0; };

/**
 * Returns the arctangent of the specified x and y coordinates, in radians between -Pi and Pi, excluding -Pi.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The x coordinate of the point.
 * @param {ApiRange | ApiName | number} arg2 - The y coordinate of the point.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.ATAN2 = function (arg1, arg2) { return 0; };

/**
 * Returns the inverse hyperbolic tangent of a number.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - Any real number between -1 and 1 excluding -1 and 1.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.ATANH = function (arg1) { return 0; };

/**
 * Converts a number into a text representation with the given radix (base).
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The number to convert.
 * @param {ApiRange | ApiName | number} arg2 - The base radix into which the number will be converted. An integer greater than or equal to 2 and less than or equal to 36.
 * @param {ApiRange | ApiName | number} [arg3] - The minimum length of the returned string. An integer greater than or equal to 0 and less than 256. If omitted, leading zeros are not added to the result.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.BASE = function (arg1, arg2, arg3) { return 0; };

/**
 * Rounds a number up, to the nearest multiple of significance.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The value to round up.
 * @param {ApiRange | ApiName | number} arg2 - The multiple of significance to round up to.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.CEILING = function (arg1, arg2) { return 0; };

/**
 * Rounds a number up, to the nearest integer or to the nearest multiple of significance.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The value to round up.
 * @param {ApiRange | ApiName | number} [arg2] - The multiple of significance to round up to. If it is omitted, the default value of 1 is used.
 * @param {ApiRange | ApiName | number} [arg3] - Specifies if negative numbers are rounded towards or away from zero. If it is omitted or set to 0, negative numbers are rounded towards zero.
 * If any other numeric value is specified, negative numbers are rounded away from zero.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.CEILING_MATH = function (arg1, arg2, arg3) { return 0; };

/**
 * Returns a number that is rounded up to the nearest integer or to the nearest multiple of significance. The number is always rounded up regardless of its sing.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The value to round up.
 * @param {ApiRange | ApiName | number} [arg2] - The multiple of significance to round up to. If it is omitted, the default value of 1 is used. If it is set to zero, the function returns 0.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.CEILING_PRECISE = function (arg1, arg2) { return 0; };

/**
 * Returns the number of combinations for a given number of items.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The total number of items, a numeric value greater than or equal to 0.
 * @param {ApiRange | ApiName | number} arg2 - The number of items in each combination, a numeric value greater than or equal to 0 but less than the total number of items.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.COMBIN = function (arg1, arg2) { return 0; };

/**
 * Returns the number of combinations with repetitions for a given number of items.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The total number of items, a numeric value greater than or equal to 0.
 * @param {ApiRange | ApiName | number} arg2 - The number of items in each combination, a numeric value greater than or equal to 0 but less than the total number of items.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.COMBINA = function (arg1, arg2) { return 0; };

/**
 * Returns the cosine of an angle.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The angle in radians for which the cosine will be returned.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.COS = function (arg1) { return 0; };

/**
 * Returns the hyperbolic cosine of a number.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - Any real number for which the hyperbolic cosine will be returned.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.COSH = function (arg1) { return 0; };

/**
 * Returns the cotangent of an angle.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The angle in radians for which the cotangent will be returned.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.COT = function (arg1) { return 0; };

/**
 * Returns the hyperbolic cotangent of a number.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The angle in radians for which the hyperbolic cotangent will be calculated. Its absolute value must be less than *2^27*.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.COTH = function (arg1) { return 0; };

/**
 * Returns the cosecant of an angle.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The angle in radians for which the cosecant will be returned.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.CSC = function (arg1) { return 0; };

/**
 * Returns the hyperbolic cosecant of an angle.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The angle in radians for which the hyperbolic cosecant will be calculated. Its absolute value must be less than *2^27*.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.CSCH = function (arg1) { return 0; };

/**
 * Converts a text representation of a number in a given base into a decimal number.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | string} arg1 - The number to convert. The string lenght must be less than or equal to 255 characters.
 * @param {ApiRange | ApiName | number} arg2 - The base Radix of the number that is converting. An integer greater than or equal to 2 and less than or equal to 36.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.DECIMAL = function (arg1, arg2) { return 0; };

/**
 * Converts radians to degrees.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The angle in radians to convert.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.DEGREES = function (arg1) { return 0; };

/**
 * Rounds the number up to the nearest multiple of significance. Negative numbers are rounded towards zero.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The value to round up.
 * @param {ApiRange | ApiName | number} arg2 - The multiple of significance to round up to.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.ECMA_CEILING = function (arg1, arg2) { return 0; };

/**
 * Rounds a positive number up and negative number down to the nearest even integer.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The value to round up.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.EVEN = function (arg1) { return 0; };

/**
 * Returns the <b>e</b> constant raised to the power of a given number. The <b>e</b> constant is equal to <b>2.71828182845904</b>, the base of the natural logarithm.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The exponent applied to the base <b>e</b>.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.EXP = function (arg1) { return 0; };

/**
 * Returns the factorial of a number, which is equal to *1*2*3*...** number.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The nonnegative number for which the factorial will be calculated.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.FACT = function (arg1) { return 0; };

/**
 * Returns the double factorial of a number.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The value for which to return the double factorial.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.FACTDOUBLE = function (arg1) { return 0; };

/**
 * Rounds a number down to the nearest multiple of significance.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The numeric value to round down.
 * @param {ApiRange | ApiName | number} arg2 - The multiple of significance to round down to. The number to round down and the multiple of significance must have the same sign.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.FLOOR = function (arg1, arg2) { return 0; };

/**
 * Returns a number that is rounded down to the nearest integer or to the nearest multiple of significance. The number is always rounded down regardless of its sign.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The numeric value to round down.
 * @param {ApiRange | ApiName | number} [arg2] - The multiple of significance to round down to. If it is omitted, the default value of 1 is used. If it is set to zero, the function returns 0.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.FLOOR_PRECISE = function (arg1, arg2) { return 0; };

/**
 * Rounds a number down, to the nearest integer or to the nearest multiple of significance.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The numeric value to round down.
 * @param {ApiRange | ApiName | number} [arg2] - The multiple of significance to round down to. If it is omitted, the default value of 1 is used.
 * @param {ApiRange | ApiName | number} [arg3] - Specifies if negative numbers are rounded towards or away from zero. If it is omitted or set to 0, negative numbers are rounded away from zero.
 * If any other numeric value is specified, negative numbers are rounded towards zero.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.FLOOR_MATH = function (arg1, arg2, arg3) { return 0; };

/**
 * Returns the greatest common divisor.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} args - Up to 255 numeric values for which the greatest common divisor will be returned. The first argument is required, subsequent arguments are optional.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.GCD = function () { return 0; };

/**
 * Rounds a number down to the nearest integer.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The real number to round down to an integer.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.INT = function (arg1) { return 0; };

/**
 * Returns a number that is rounded up to the nearest integer or to the nearest multiple of significance regardless of the sign of the number.
 * The number is always rounded up regardless of its sing.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The numeric value to round up.
 * @param {ApiRange | ApiName | number} [arg2] - The multiple of significance to round up to. If it is omitted, the default value of 1 is used. If it is set to zero, the function returns 0.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.ISO_CEILING = function (arg1, arg2) { return 0; };

/**
 * Returns the least common multiple.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} args - Up to 255 numeric values for which the least common multiple will be returned. The first argument is required, subsequent arguments are optional.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.LCM = function () { return 0; };

/**
 * Returns the natural logarithm of a number.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The positive real number for which the natural logarithm will be returned.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.LN = function (arg1) { return 0; };

/**
 * Returns the logarithm of a number to the specified base.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The positive real number for which the logarithm will be returned.
 * @param {ApiRange | ApiName | number} [arg2] - The logarithm base. If omitted, it is equal to 10.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.LOG = function (arg1, arg2) { return 0; };

/**
 * Returns the base-10 logarithm of a number.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The positive real number for which the base-10 logarithm will be returned.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.LOG10 = function (arg1) { return 0; };

/**
//  * Returns the matrix determinant of an array.
//  * @memberof ApiWorksheetFunction
//  * @param {any} arg1 Is a numeric array with an equal number of rows and columns, either a cell range or an array constant.
//  * @returns {number | string | boolean}
//  */
// ApiWorksheetFunction.prototype.MDETERM = function (arg1) { return 0; };

/**
//  * Returns the inverse matrix for the matrix stored in an array.
//  * @memberof ApiWorksheetFunction
//  * @param {any} arg1 Is a numeric array with an equal number of rows and columns, either a cell range or an array constant.
//  * @returns {number | string | boolean}
//  */
// ApiWorksheetFunction.prototype.MINVERSE = function (arg1) { return 0; };

/**
//  * Returns the matrix product of two arrays, an array with the same number of rows as array1 and columns as array2.
//  * @memberof ApiWorksheetFunction
//  * @param {any} arg1 Is the first array of numbers to multiply and must have the same number of columns as Array2 has rows.
//  * @param {any} arg2.
//  * @returns {number | string | boolean}
//  */
// ApiWorksheetFunction.prototype.MMULT = function (arg1, arg2) { return 0; };

/**
 * Returns the remainder after a number is divided by a divisor.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The number to divide and find the remainder.
 * @param {ApiRange | ApiName | number} arg2 - The number to divide by.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.MOD = function (arg1, arg2) { return 0; };

/**
 * Returns a number rounded to the desired multiple.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The value to round.
 * @param {ApiRange | ApiName | number} arg2 - The multiple to round the number to.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.MROUND = function (arg1, arg2) { return 0; };

/**
 * Returns the ratio of the factorial of a sum of numbers to the product of factorials.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} args - Up to 255 numeric values for which the multinomial will be returned. The first argument is required, subsequent arguments are optional.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.MULTINOMIAL = function () { return 0; };

/**
 * Returns the unit matrix for the specified dimension.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - An integer specifying the dimension of the unit matrix to be returned.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.MUNIT = function (arg1) { return 0; };

/**
 * Rounds a positive number up and negative number down to the nearest odd integer.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The value to round.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.ODD = function (arg1) { return 0; };

/**
 * Returns the mathematical constant <b>pi</b>, equal to <b>3.14159265358979</b>, accurate to 15 digits.
 * @memberof ApiWorksheetFunction
 * @returns {number}
 */
ApiWorksheetFunction.prototype.PI = function () { return 0; };

/**
 * Returns the result of a number raised to a power.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The base number. It can be any real number.
 * @param {ApiRange | ApiName | number} arg2 - The exponent to which the base number is raised.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.POWER = function (arg1, arg2) { return 0; };

/**
 * Multiplies all the numbers given as arguments.
 * @memberof ApiWorksheetFunction
 * @param {number | ApiRange | number[]} args - Up to 255 numeric values that will be multiplied. The first argument is required, subsequent arguments are optional.
 * Arguments can be numbers, ranges, or arrays of numbers.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.PRODUCT = function () { return 0; };

/**
 * Returns the integer portion of a division.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The dividend, a numeric value.
 * @param {ApiRange | ApiName | number} arg2 - The divisor, a numeric value.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.QUOTIENT = function (arg1, arg2) { return 0; };

/**
 * Converts degrees to radians.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - An angle in degrees to convert.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.RADIANS = function (arg1) { return 0; };

/**
 * Returns a random number greater than or equal to 0 and less than 1, evenly distributed (changes on recalculation).
 * @memberof ApiWorksheetFunction
 * @returns {number}
 */
ApiWorksheetFunction.prototype.RAND = function () { return 0; };

/**
 * Returns a random number between the numbers specified.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The smallest integer value.
 * @param {ApiRange | ApiName | number} arg2 - The largest integer value.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.RANDBETWEEN = function (arg1, arg2) { return 0; };

/**
 * Converts an arabic numeral to a roman numeral in the string format.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - A numeric value greater than or equal to 1 and less than 3999.
 * @param {ApiRange | ApiName | number} [arg2] - A roman numeral type: <b>0</b> - classic, <b>1</b> - more concise, <b>2</b> - more concise, <b>3</b> - more concise, <b>4</b> - simplified.
 * @returns {string}
 */
ApiWorksheetFunction.prototype.ROMAN = function (arg1, arg2) { return ""; };

/**
 * Rounds a number to a specified number of digits.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The number to round.
 * @param {ApiRange | ApiName | number} arg2 - The number of digits to round to. If this argument is negative, the number will be rounded to the left of the decimal point.
 * If it is equal to zero, the number will be rounded to the nearest integer.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.ROUND = function (arg1, arg2) { return 0; };

/**
 * Rounds a number down, toward zero.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - Any real number that will be rounded down.
 * @param {ApiRange | ApiName | number} arg2 - The number of digits to round to. If this argument is negative, the number will be rounded to the left of the decimal point.
 * If it is equal to zero, the number will be rounded to the nearest integer.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.ROUNDDOWN = function (arg1, arg2) { return 0; };

/**
 * Rounds a number up, away from zero.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - Any real number that will be rounded up.
 * @param {ApiRange | ApiName | number} arg2 - The number of digits to round to. If this argument is negative, the number will be rounded to the left of the decimal point.
 * If it is equal to zero, the number will be rounded to the nearest integer.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.ROUNDUP = function (arg1, arg2) { return 0; };

/**
 * Returns the secant of an angle.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The angle in radians for which the secant will be returned.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.SEC = function (arg1) { return 0; };

/**
 * Returns the hyperbolic secant of an angle.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The angle in radians for which the hyperbolic secant will be returned.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.SECH = function (arg1) { return 0; };

/**
 * Returns the sum of a power series based on the formula.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The input value to the power series.
 * @param {ApiRange | ApiName | number} arg2 - The initial power to which x will be raised.
 * @param {ApiRange | ApiName | number} arg3 - The step by which to increase n for each term in the series.
 * @param {ApiRange | ApiName | number} arg4 - A set of coefficients by which each successive power of x is multiplied.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.SERIESSUM = function (arg1, arg2, arg3, arg4) { return 0; };

/**
 * Returns the sign of a number: <b>1</b> if the number is positive, <b>0</b> if the number is zero, or <b>-1</b> if the number is negative.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - Any real number.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.SIGN = function (arg1) { return 0; };

/**
 * Returns the sine of an angle.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The angle in radians for which the sine will be returned. If your argument is in degrees, multiply it by *PI()/180*.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.SIN = function (arg1) { return 0; };

/**
 * Returns the hyperbolic sine of a number.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - Any real number for which the hyperbolic sine will be returned.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.SINH = function (arg1) { return 0; };

/**
 * Returns the square root of a number.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The number for which the square root will be returned.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.SQRT = function (arg1) { return 0; };

/**
 * Returns the square root of (number * pi).
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The number by which pi is multiplied.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.SQRTPI = function (arg1) { return 0; };

/**
 * Returns a subtotal in a list or database.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - A numeric value that specifies which function to use for the subtotal: <b>1 (101)</b> - AVERAGE, <b>2 (102)</b> - COUNT,
 * <b>3 (103)</b> - COUNTA, <b>4 (104)</b> - MAX, <b>5 (105)</b> - MIN,
 * <b>6 (106)</b> - PRODUCT, <b>7 (107)</b> - STDEV, <b>8 (108)</b> - STDEVP, <b>9 (109)</b> - SUM, <b>10 (110)</b> - VAR, <b>11 (111)</b> - VARP.
 * 1-11 includes manually-hidden rows, while 101-111 excludes them;
 * filtered-out cells are always excluded.
 * @param {ApiRange | ApiName} args - Up to 255 ranges containing the values for which the subtotal will be returned. The first argument is required, subsequent arguments are optional.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.SUBTOTAL = function () { return 0; };

/**
 * Adds all the numbers in a range of cells.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | string | number | boolean | Array<string | number | boolean>} args - Up to 255 numeric values to add. The first argument is required, subsequent arguments are optional.
 * Arguments can be numbers, logical values, text representations of numbers, ranges, or arrays.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.SUM = function () { return 0; };

/**
 * Adds the cells specified by a given condition or criteria.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName} arg1 - The range of cells to be evaluated.
 * @param {ApiRange | ApiName | number | string} arg2 - The condition or criteria in the form of a number, expression, or text that defines which cells will be added.
 * @param {ApiRange | ApiName} [arg3] - The range to sum. If omitted, the cells in range are used.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.SUMIF = function (arg1, arg2, arg3) { return 0; };

/**
 * Adds the cells specified by a given set of conditions or criteria.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName} arg1 - The range of cells to be evaluated.
 * @param {ApiRange | ApiName | number | string} arg2 - The first condition or criteria in the form of a number, expression, or text that defines which cells will be added.
 * @param {ApiRange | ApiName} [arg3] - The first range to sum. If omitted, the cells in range are used.
 * @param {ApiRange | ApiName | number | string} arg4 - Up to 127 additional conditions or criteria in the form of a number, expression, or text that defines which cells will be added.
 * These arguments are optional.
 * @param {ApiRange | ApiName} [arg5] - Up to 127 actual ranges to be used to be added. If omitted, the cells in the range are used. These arguments are optional.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.SUMIFS = function () { return 0; };

/**
//  * Returns the sum of the products of corresponding ranges or arrays.
//  * @memberof ApiWorksheetFunction
//  * @returns {number | string | boolean}
//  */
// ApiWorksheetFunction.prototype.SUMPRODUCT = function () { return 0; };

/**
 * Returns the sum of the squares of the arguments.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number | string | boolean | Array<number | string | boolean>} args - Up to 255 numeric values for which the sum of the squares will be calculated.
 * The first argument is required, subsequent arguments are optional.
 * The arguments can be numbers, names, logical values or text representations of numbers, ranges of cells that contain numbers, or arrays.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.SUMSQ = function () { return 0; };

/**
//  * Sums the differences between the squares of two corresponding ranges or arrays.
//  * @memberof ApiWorksheetFunction
//  * @param {any} arg1 Is the first range or array of numbers and can be a number or name, array, or reference that contains numbers.
//  * @param {any} arg2 Is the second range or array of numbers and can be a number or name, array, or reference that contains numbers.
//  * @returns {number | string | boolean}
//  */
// ApiWorksheetFunction.prototype.SUMX2MY2 = function (arg1, arg2) { return 0; };

/**
//  * Returns the sum total of the sums of squares of numbers in two corresponding ranges or arrays.
//  * @memberof ApiWorksheetFunction
//  * @param {any} arg1 Is the first range or array of numbers and can be a number or name, array, or reference that contains numbers.
//  * @param {any} arg2 Is the second range or array of numbers and can be a number or name, array, or reference that contains numbers.
//  * @returns {number | string | boolean}
//  */
// ApiWorksheetFunction.prototype.SUMX2PY2 = function (arg1, arg2) { return 0; };

/**
//  * Sums the squares of the differences in two corresponding ranges or arrays.
//  * @memberof ApiWorksheetFunction
//  * @param {any} arg1 Is the first range or array of values and can be a number or name, array, or reference that contains numbers.
//  * @param {any} arg2 Is the second range or array of values and can be a number or name, array, or reference that contains numbers.
//  * @returns {number | string | boolean}
//  */
// ApiWorksheetFunction.prototype.SUMXMY2 = function (arg1, arg2) { return 0; };

/**
 * Returns the tangent of an angle.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The angle in radians for which the tangent will be returned. If the argument is in degrees, multiply it by *PI()/180*.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.TAN = function (arg1) { return 0; };

/**
 * Returns the hyperbolic tangent of a number.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - Any real number for which the hyperbolic tangent will be returned.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.TANH = function (arg1) { return 0; };

/**
 * Truncates a number to an integer by removing the decimal, or fractional, part of the number.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The number which will be truncated.
 * @param {ApiRange | ApiName | number} [arg2] - A number specifying the precision of the truncation. If this argument is omitted, it is equal to 0 (zero).
 * @returns {number}
 */
ApiWorksheetFunction.prototype.TRUNC = function (arg1, arg2) { return 0; };

/**
 * Chooses a value or action to perform from a list of values, based on an index number.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The position of the value in the list of values, a numeric value greater than or equal to 1 but less than the number of values in the list of values.
 * @param {number | string | ApiRange | ApiName} args - Up to 254 values or the selected range of cells to analyze.
 * The first argument is required, subsequent arguments are optional. Arguments can be numbers, ranges, names, or text strings.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.CHOOSE = function () { return 0; };

/**
 * Returns the number of columns in the cell range.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number[]} arg1 - A range or array of cells for which the number of columns will be returned.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.COLUMNS = function (arg1) { return 0; };

/**
 * Looks for a value in the top row of a table or array of values and returns the value in the same column from the specified row.
 * @memberof ApiWorksheetFunction
 * @param {number | string | ApiRange | ApiName} arg1 - The value to be found in the first row of the table and can be a value, a reference, or a text string.
 * @param {ApiRange | ApiName} arg2 - A table of text, numbers, or logical values in which data is looked up. The data is sorted in ascending order.
 * This argument can be a range of cells or a range name.
 * @param {ApiRange | ApiName | number} arg3 - The row number in data table from which the matching value should be returned. The first row of values in the table is row 1.
 * @param {ApiRange | ApiName | boolean} [arg4] - A logical value which specifies whether to find the closest match in the top row (sorted in ascending order) (<b>true</b> or omitted)
 * or find an exact match (<b>false</b>).
 * @returns {number | string}
 */
ApiWorksheetFunction.prototype.HLOOKUP = function (arg1, arg2, arg3, arg4) { return 0; };

/**
 * Creates a shortcut that jumps to another location in the current workbook, or opens a document stored on your hard drive, a network server, or on the Internet.
 * @memberof ApiWorksheetFunction
 * @param {string | ApiRange | ApiName} arg1 - The text giving the path and file name to the document to be opened, a hard drive location, UNC address, or URL path.
 * @param {string | ApiRange | number | ApiName} [arg2] - Text or a number that is displayed in the cell. If omitted, the cell displays the link location text.
 * @returns {string}
 */
ApiWorksheetFunction.prototype.HYPERLINK = function (arg1, arg2) { return ""; };

/**
 * Returns a value or reference of the cell at the intersection of a particular row and column, in a given range.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number[]} arg1 - A range of cells or an array constant.
 * @param {ApiRange | ApiName | number} arg2 - The row in the range from which to return a value. If omitted, the column number is required.
 * @param {ApiRange | ApiName | number} [arg3] - The column in the range from which to return a value. If omitted, the row number is required.
 * @param {ApiRange | ApiName | number} [arg4] - An area to use in case the range contains several ranges. If it is omitted, the function will assume argument to be 1.
 * @returns {number | string}
 */
ApiWorksheetFunction.prototype.INDEX = function (arg1, arg2, arg3, arg4) { return 0; };

/**
 * Looks up a value either from a one-row or one-column range. Provided for backwards compatibility.
 * @memberof ApiWorksheetFunction
 * @param {number | string | boolean | ApiRange | ApiName} arg1 - A value that is searched for in the first vector. It can be a number, text, a logical value, or a name or reference to a value.
 * @param {ApiRange | ApiName} arg2 - A range that contains only one row or one column of text, numbers, or logical values, placed in ascending order.
 * @param {ApiRange | ApiName} [arg3] - A range that contains only one row or column. It must be the same size as the first vector.
 * @returns {number | string | boolean}
 */
ApiWorksheetFunction.prototype.LOOKUP = function (arg1, arg2, arg3) { return 0; };

/**
 * The match type.
 * * <b>-1</b> - The values must be sorted in descending order. If the exact match is not found, the function will return the smallest value that is greater than the searched value.
 * * <b>0</b> - The values can be sorted in any order. If the exact match is not found, the function will return the *#N/A* error.
 * * <b>1</b> (or omitted) - The values must be sorted in ascending order. If the exact match is not found, the function will return the largest value that is less than the searched value.
 * @typedef {("-1" | "0" | "1")} MatchType
 * */

/**
 * Returns the relative position of an item in a range that matches the specified value in the specified order.
 * @memberof ApiWorksheetFunction
 * @param {number | string | boolean | ApiRange | ApiName} arg1 - The value to be matched in the range. It can be a number, text, or logical value, or a reference to one of these.
 * @param {ApiRange | ApiName | Array<number | string | boolean>} arg2 - A contiguous range of cells or an array containing possible lookup values.
 * @param {ApiRange | ApiName | number} [arg3] - A number 1, 0, or -1 indicating which value to return.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.MATCH = function (arg1, arg2, arg3) { return 0; };

/**
 * Returns the number of rows in a range.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | Array<number | string | boolean>} arg1 - A range of cells or an array for which the number of rows will be returned.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.ROWS = function (arg1) { return 0; };

/**
 * Converts a vertical range of cells to a horizontal range, or vice versa.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | Array<number | string | boolean>} arg1 - A range of cells on a worksheet or an array that will be transposed.
 * @returns {ApiRange}
 */
ApiWorksheetFunction.prototype.TRANSPOSE = function (arg1) { return new ApiRange(); };

/**
 * Looks for a value in the leftmost column of a table and then returns a value in the same row from the specified column. By default, the table must be sorted in an ascending order.
 * @memberof ApiWorksheetFunction
 * @param {number | string | ApiRange | ApiName} arg1 - The value to be found in the first column of the table. It can be a value, a reference, or a text string.
 * @param {ApiRange | ApiName} arg2 - A table of text, numbers, or logical values, in which data is retrieved. It can be a range of cells.
 * @param {ApiRange | ApiName | number} arg3 - The column number in the data table from which the matching value should be returned. The first column of values in the table is column 1.
 * @param {ApiRange | ApiName | boolean} [arg4] - A logical value that specifies whether to find the closest match in the first column (sorted in ascending order) (<b>true</b> or omitted)
 * or find an exact match (<b>false</b>).
 * @returns {number | string}
 */
ApiWorksheetFunction.prototype.VLOOKUP = function (arg1, arg2, arg3, arg4) { return 0; };

/**
 * The error value.
 * * <b>"#NULL!"</b> - 1
 * * <b>"#DIV/0!"</b> - 2
 * * <b>"#VALUE!"</b> - 3
 * * <b>"#REF!"</b> - 4
 * * <b>"#NAME?"</b> - 5
 * * <b>"#NUM!"</b> - 6
 * * <b>"#N/A"</b> - 7
 * * <b>"#GETTING_DATA"</b> - 8
 * * <b>"Other"</b> - "#N/A"
 * @typedef {("#NULL!" | "#DIV/0!" | "#VALUE!" | "#REF!" | "#NAME?" | "#NUM!" | "#N/A" | "#GETTING_DATA")} ErrorValue
 * */

/**
 * Returns a number matching an error value.
 * @memberof ApiWorksheetFunction
 * @param {ErrorValue | ApiRange | ApiName} arg1 - The error value for which the identifying number will be returned. It can be an actual error value or a reference to a cell containing an error value.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.ERROR_TYPE = function (arg1) { return 0; };

/**
 * Checks whether a value is an error other than *#N/A*, and returns <b>true</b> or <b>false</b>.
 * @memberof ApiWorksheetFunction
 * @param {number | string | boolean | ApiRange | ApiName} arg1 - The value to test.
 * The value can be an empty cell, error, logical value, text, number, range, or range name.
 * @returns {boolean}
 */
ApiWorksheetFunction.prototype.ISERR = function (arg1) { return true; };

/**
 * Checks whether a value is an error, and returns <b>true</b> or <b>false</b>.
 * @memberof ApiWorksheetFunction
 * @param {number | string | boolean | ApiRange | ApiName} arg1 - The value to test.
 * The value can be an empty cell, error, logical value, text, number, range, or range name.
 * @returns {boolean}
 */
ApiWorksheetFunction.prototype.ISERROR = function (arg1) { return true; };

/**
 * Returns <b>true</b> if a number is even.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The value to test.
 * @returns {boolean}
 */
ApiWorksheetFunction.prototype.ISEVEN = function (arg1) { return true; };

/**
 * Checks whether a reference to a cell contains a formula, and returns <b>true</b> or <b>false</b>.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName} arg1 - A cell range to test. This argument can be a range or a range name.
 * @returns {boolean}
 */
ApiWorksheetFunction.prototype.ISFORMULA = function (arg1) { return true; };

/**
 * Checks whether a value is a logical value (<b>true</b> or <b>false</b>), and returns <b>true</b> or <b>false</b>.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | string | number | boolean | ApiName} arg1 - The value to test.
 * The value can be an empty cell, error, logical value, text, number, range, or range name.
 * @returns {boolean}
 */
ApiWorksheetFunction.prototype.ISLOGICAL = function (arg1) { return true; };

/**
 * Checks whether a value is *#N/A*, and returns <b>true</b> or <b>false</b>.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | string | number | boolean | ApiName} arg1 - The value to test.
 * The value can be an empty cell, error, logical value, text, number, range, or range name.
 * @returns {boolean}
 */
ApiWorksheetFunction.prototype.ISNA = function (arg1) { return true; };

/**
 * Checks whether a value is not text (blank cells are not text), and returns <b>true</b> or <b>false</b>.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | string | number | boolean | ApiName} arg1 - The value to test.
 * The value can be an empty cell, error, logical value, text, number, range, or range name.
 * @returns {boolean}
 */
ApiWorksheetFunction.prototype.ISNONTEXT = function (arg1) { return true; };

/**
 * Checks whether a value is a number, and returns <b>true</b> or <b>false</b>.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | string | number | boolean | ApiName} arg1 - The value to test.
 * The value can be an empty cell, error, logical value, text, number, range, or range name.
 * @returns {boolean}
 */
ApiWorksheetFunction.prototype.ISNUMBER = function (arg1) { return true; };

/**
 * Returns <b>true</b> if a number is odd.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number} arg1 - The value to test.
 * @returns {boolean}
 */
ApiWorksheetFunction.prototype.ISODD = function (arg1) { return true; };

/**
 * Checks whether a value is a reference, and returns <b>true</b> or <b>false</b>.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | string | number | boolean | ApiName} arg1 - The value to test.
 * The value can be an empty cell, error, logical value, text, number, range, or range name.
 * @returns {boolean}
 */
ApiWorksheetFunction.prototype.ISREF = function (arg1) { return true; };

/**
 * Checks whether a value is text, and returns <b>true</b> or <b>false</b>.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | string | number | boolean | ApiName} arg1 - The value to test.
 * The value can be an empty cell, error, logical value, text, number, range, or range name.
 * @returns {boolean}
 */
ApiWorksheetFunction.prototype.ISTEXT = function (arg1) { return true; };

/**
 * Converts a value to a number, dates to serial numbers, <b>true</b> to 1, error to {@link global#ErrorValue ErrorValue}, anything else to 0 (zero).
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number | string | boolean} arg1 - The value to be converted. The value can be a logical value, text, or number.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.N = function (arg1) { return 0; };

/**
 * Returns the *#N/A* error value which means "no value is available".
 * @memberof ApiWorksheetFunction
 * @returns {string}
 */
ApiWorksheetFunction.prototype.NA = function () { return ""; };

/**
 * Returns the sheet number of the reference sheet.
 * @memberof ApiWorksheetFunction
 * @param {string | ApiRange | ApiName} [arg1] - The name of a sheet or a reference for which the sheet number will be returned. If omitted the number of the sheet containing the function is returned.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.SHEET = function (arg1) { return 0; };

/**
 * Returns the number of sheets in a reference.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName} [arg1] - A reference for which the number of sheets will be returned. If omitted the number of sheets in the workbook containing the function is returned.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.SHEETS = function (arg1) { return 0; };

/**
 * Returns an integer representing the data type of a value: number = 1; text = 2; logical value = 4; error value = 16; array = 64; compound data = 128.
 * @memberof ApiWorksheetFunction
 * @param {number | string | boolean | Array<number | string | boolean> | ApiRange | ApiName} arg1 - A value to test.
 * @returns {number}
 */
ApiWorksheetFunction.prototype.TYPE = function (arg1) { return 0; };

/**
 * Checks whether all conditions in a test are <b>true</b>.
 * @memberof ApiWorksheetFunction
 * @param {number | string | ApiRange | boolean | ApiName} args - A condition to check.
 * @returns {boolean}
 */
ApiWorksheetFunction.prototype.AND = function () { return true; };

/**
 * Returns the <b>false</b> logical value.
 * @memberof ApiWorksheetFunction
 * @returns {boolean}
 */
ApiWorksheetFunction.prototype.FALSE = function () { return true; };

/**
 * Checks whether a condition is met, and returns one value if <b>true</b>, and another value if <b>false</b>.
 * @memberof ApiWorksheetFunction
 * @param {number | string | ApiRange | ApiName | boolean} arg1 - Any value or expression that can be evaluated to <b>true</b> or <b>false</b>.
 * @param {number | string | ApiRange | ApiName | boolean} arg2 - The value that is returned if the condition is <b>true</b>. If omitted, <b>true</b> is returned. You can nest up to seven IF functions.
 * @param {ApiRange | ApiName | number | string | boolean} [arg3] - The value that is returned if the condition is <b>false</b>. If omitted, <b>false</b> is returned.
 * @returns {number | string | boolean}
 */
ApiWorksheetFunction.prototype.IF = function (arg1, arg2, arg3) { return 0; };

/**
 * Checks if there is an error in the formula in the first argument. The function returns the result of the formula if there is no error, or the value specified in the second argument if there is one.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number | string | boolean} arg1 - The value, expression, or reference that is checked for an error.
 * @param {ApiRange | ApiName | number | string | boolean} arg2 - The value to be returned if the formula evaluates to an error. The following errors are evaluated: <b>#N/A</b>, <b>#VALUE!</b>, <b>#REF!</b>, <b>#DIV/0!</b>, <b>#NUM!</b>, <b>#NAME?</b>, <b>#NULL!</b>.
 * @returns {number | string | boolean}
 */
ApiWorksheetFunction.prototype.IFERROR = function (arg1, arg2) { return 0; };

/**
 * Checks if there is an error in the formula in the first argument. The function returns the specified value if the formula returns the *#N/A* error value, otherwise returns the result of the formula.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number | string | boolean} arg1 - The value, expression, or reference that is checked for an error.
 * @param {ApiRange | ApiName | number | string | boolean} arg2 - The value to return if the formula evaluates to the *#N/A* error value.
 * @returns {number | string | boolean}
 */
ApiWorksheetFunction.prototype.IFNA = function (arg1, arg2) { return 0; };

/**
 * Checks if the specified logical value is <b>true</b> or <b>false</b>. The function returns <b>true</b> if the argument is <b>false</b> and <b>false</b> if the argument is <b>true</b>.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | number | string | boolean} arg1 - A value or expression that can be evaluated to <b>true</b> or <b>false</b>.
 * @returns {boolean}
 */
ApiWorksheetFunction.prototype.NOT = function (arg1) { return true; };

/**
 * Checks whether any of the arguments are <b>true</b>. Returns <b>false</b> only if all arguments are <b>false</b>.
 * @memberof ApiWorksheetFunction
 * @param {number | string | ApiRange | ApiName | boolean} args - A condition to check.
 * @returns {boolean}
 */
ApiWorksheetFunction.prototype.OR = function () { return true; };

/**
 * Returns the <b>true</b> logical value.
 * @memberof ApiWorksheetFunction
 * @returns {boolean}
 */
ApiWorksheetFunction.prototype.TRUE = function () { return true; };

/**
 * Returns the logical <b>Exclusive Or</b> value of all arguments. The function returns <b>true</b> when the number of <b>true</b> inputs is odd and <b>false</b> when the number of <b>true</b> inputs is even.
 * @memberof ApiWorksheetFunction
 * @param {ApiRange | ApiName | boolean | boolean[]} args - The conditions to check.
 * @returns {boolean}
 */
ApiWorksheetFunction.prototype.XOR = function () { return true; };

/**
 * Returns the mail merge data.
 * @memberof ApiInterface
 * @param {number} nSheet - The sheet index.
 * @param {boolean} [bWithFormat=false] - Specifies that the data will be received with the format.
 * @returns {string[][]}
 */
ApiInterface.prototype.GetMailMergeData = function (nSheet, bWithFormat) { return [""]; };

/**
 * Recalculates all formulas in the active workbook.
 * @memberof ApiInterface
 * @param {Function} fLogger - A function which specifies the logger object for checking recalculation of formulas.
 * @returns {boolean}
 */
ApiInterface.prototype.RecalculateAllFormulas = function (fLogger) { return true; };

/**
 * Inserts the specified pivot table into an existing worksheet.
 * @memberof ApiInterface
 * @param {ApiRange} dataRef - The source data range.
 * @param {ApiRange} pivotRef - A range in which the pivot table will be located.
 * @param {boolean} confirmation - Specifies whether to replace the data in the specified pivot table range (if it exists) or create a dialog box for this (if it exists).
 * @returns {ApiPivotTable}
 * @since 8.2.0
 */
ApiInterface.prototype.InsertPivotExistingWorksheet = function (dataRef, pivotRef, confirmation) { return new ApiPivotTable(); };

/**
 * Inserts the specified pivot table into a new worksheet.
 * @memberof ApiInterface
 * @param {ApiRange} dataRef - The source data range.
 * @param {ApiRange} [newSheetName] - A new worksheet name.
 * @returns {ApiPivotTable}
 * @since 8.2.0
 */
ApiInterface.prototype.InsertPivotNewWorksheet = function (dataRef, newSheetName) { return new ApiPivotTable(); };

/**
 * Returns a pivot table by its name, or null if it does not exist.
 * @memberof ApiInterface
 * @param {string} name - The pivot table name.
 * @returns {ApiPivotTable|null}
 * @since 8.2.0
 */
ApiInterface.prototype.GetPivotByName = function (name) { return new ApiPivotTable(); };

/**
 * Refreshes all pivot tables.
 * @memberof ApiInterface
 * @since 8.2.0
 */
ApiInterface.prototype.RefreshAllPivots = function () {};

/**
 * Returns all pivot tables.
 * @memberof ApiInterface
 * @returns {ApiPivotTable[]}
 * @since 8.2.0
 */
ApiInterface.prototype.GetAllPivotTables = function () { return [new ApiPivotTable()]; };

/**
 * Returns all pivot tables.
 * @memberof ApiInterface
 * @returns {ApiPivotTable[]}
 * @since 8.2.0
 */
ApiInterface.prototype.PivotTables = ApiInterface.prototype.GetAllPivotTables ();

/**
 * Subscribes to the specified event and calls the callback function when the event fires.
 * @function
 * @memberof ApiInterface
 * @param {string} eventName - The event name.
 * @param {function} callback - Function to be called when the event fires.
 * @fires Api#onWorksheetChange
 */
ApiInterface.prototype["attachEvent"] = ApiInterface.prototype.attachEvent;{};

/**
 * Unsubscribes from the specified event.
 * @function
 * @memberof ApiInterface
 * @param {string} eventName - The event name.
 * @fires Api#onWorksheetChange
 */
ApiInterface.prototype["detachEvent"] = ApiInterface.prototype.detachEvent;{};

/**
 * Returns an array of ApiComment objects.
 * @memberof ApiInterface
 * @param {string} sText - The comment text.
 * @param {string} sAuthor - The author's name (optional).
 * @returns {ApiComment | null}
 * @since 7.5.0
 */
ApiInterface.prototype.AddComment = function (sText, sAuthor) { return new ApiComment(); };

/**
 * Returns a comment from the current document by its ID.
 * @memberof ApiInterface
 * @param {string} sId - The comment ID.
 * @returns {ApiComment}
 */
ApiInterface.prototype.GetCommentById = function (sId) { return new ApiComment(); };

/**
 * Returns all comments related to the whole workbook.
 * @memberof ApiInterface
 * @returns {ApiComment[]}
 */
ApiInterface.prototype.GetComments = function () { return [new ApiComment()]; };

/**
 * Returns all comments related to the whole workbook.
 * @memberof ApiInterface
 * @returns {ApiComment[]}
 */
ApiInterface.prototype.Comments = ApiInterface.prototype.GetComments ();

/**
 * Returns all comments from the current workbook including comments from all worksheets.
 * @memberof ApiInterface
 * @returns {ApiComment[]}
 */
ApiInterface.prototype.GetAllComments = function () { return [new ApiComment()]; };

/**
 * Returns all comments from the current workbook including comments from all worksheets.
 * @memberof ApiInterface
 * @returns {ApiComment[]}
 */
ApiInterface.prototype.AllComments = ApiInterface.prototype.GetAllComments ();

/**
 * Specifies a type of freeze panes.
 * @typedef {("row" | "column" | "cell" | null )} FreezePaneType
 */

/**
 * Sets a type to the freeze panes.
 * @memberof ApiInterface
 * @param {FreezePaneType} FreezePaneType - The freeze panes type ("null" to unfreeze).
 * @since 8.0.0
 */
ApiInterface.prototype.SetFreezePanesType = function (FreezePaneType) {};

/**
 * Returns the freeze panes type.
 * @memberof ApiInterface
 * @returns {FreezePaneType} FreezePaneType - The freeze panes type ("null" if there are no freeze panes).
 * @since 8.0.0
 */
ApiInterface.prototype.GetFreezePanesType = function () { return new FreezePaneType(); };

/**
 * Returns the freeze panes type.
 * @memberof ApiInterface
 * @returns {FreezePaneType} FreezePaneType - The freeze panes type ("null" if there are no freeze panes).
 * @since 8.0.0
 */
ApiInterface.prototype.FreezePanes = ApiInterface.prototype.GetFreezePanesType ();

/**
 * Returns the cell reference style.
 * @memberof ApiInterface
 * @returns {ReferenceStyle} - The cell reference style.
 * @since 8.1.0
 */
ApiInterface.prototype.GetReferenceStyle = function () { return new ReferenceStyle(); };

/**
 * Sets the cell reference style.
 * @memberof ApiInterface
 * @param {ReferenceStyle} sReferenceStyle - The cell reference style.
 * @since 8.1.0
 */
ApiInterface.prototype.SetReferenceStyle = function (sReferenceStyle) {};

/**
 * Sets the cell reference style.
 * @memberof ApiInterface
 * @param {ReferenceStyle} sReferenceStyle - The cell reference style.
 * @since 8.1.0
 */
ApiInterface.prototype.ReferenceStyle = ApiInterface.prototype.SetReferenceStyle ();

/**
 * Returns the document information:
 * <b>Application</b> - the application the document has been created with.
 * <b>CreatedRaw</b> - the date and time when the file was created.
 * <b>Created</b> - the parsed date and time when the file was created.
 * <b>LastModifiedRaw</b> - the date and time when the file was last modified.
 * <b>LastModified</b> - the parsed date and time when the file was last modified.
 * <b>LastModifiedBy</b> - the name of the user who has made the latest change to the document.
 * <b>Authors</b> - the persons who has created the file.
 * <b>Title</b> - this property allows you to simplify your documents classification.
 * <b>Tags</b> - this property allows you to simplify your documents classification.
 * <b>Subject</b> - this property allows you to simplify your documents classification.
 * <b>Comment</b> - this property allows you to simplify your documents classification.
 * @memberof ApiInterface
 * @returns {object}
 */
ApiInterface.prototype.GetDocumentInfo = function(){ return new object(); };

/**
 * Returns the core properties interface for the workbook.
 * This method is used to view or modify standard metadata such as title, author, and keywords.
 * @memberof ApiInterface
 * @returns {ApiCore}
 * @since 9.0.0
 */
ApiInterface.prototype.GetCore = function () { return new ApiCore(); };

/**
 * Returns the workbook custom properties.
 * @memberof ApiInterface
 * @returns {ApiCustomProperties}
 * @since 9.0.0
 */
ApiInterface.prototype.GetCustomProperties = function () { return new ApiCustomProperties(); };

/**
 * Saves changes to the specified document.
 *
 * @memberof ApiWorkbook
 * @since 9.1.0
 */
ApiWorkbook.prototype.Save = function () {};

/**
 * Returns a sheet collection that represents all the sheets in the workbook.
 *
 * @memberof ApiWorkbook
 * @returns {ApiWorksheet[]}
 * @since 9.1.0
 */
ApiWorkbook.prototype.GetSheets = function () { return [new ApiWorksheet()]; };

/**
 * Returns all pivot tables in the workbook.
 *
 * @memberof ApiWorkbook
 * @returns {ApiPivotTable[]}
 * @since 9.1.0
 */
ApiWorkbook.prototype.GetAllPivotTables = function () { return [new ApiPivotTable()]; };

/**
 * Returns the custom properties of the workbook.
 *
 * @memberof ApiWorkbook
 * @returns {ApiCustomProperties}
 * @since 9.1.0
 */
ApiWorkbook.prototype.GetCustomProperties = function () { return new ApiCustomProperties(); };

/**
 * Returns the theme of the workbook.
 *
 * @memberof ApiWorkbook
 * @returns {ApiTheme}
 * @since 9.1.0
 */
ApiWorkbook.prototype.GetTheme = function () { return new ApiTheme(); };

/**
 * Returns the name of the workbook.
 *
 * @memberof ApiWorkbook
 * @returns {string}
 * @since 9.1.0
 */
ApiWorkbook.prototype.GetName = function () { return ""; };

/**
 * Returns the active sheet of the workbook.
 *
 * @memberof ApiWorkbook
 * @returns {ApiWorksheet}
 * @since 9.1.0
 */
ApiWorkbook.prototype.GetActiveSheet = function () { return new ApiWorksheet(); };

/**
 * Returns the active chart of the workbook.
 *
 * @memberof ApiWorkbook
 * @returns {ApiChart | null}
 * @since 9.1.0
 */
ApiWorkbook.prototype.GetActiveChart = function () { return new ApiChart(); };

/**
 * Returns the state of sheet visibility.
 * @memberof ApiWorksheet
 * @returns {boolean}
 */
ApiWorksheet.prototype.GetVisible = function () { return true; };

/**
 * Sets the state of sheet visibility.
 * @memberof ApiWorksheet
 * @param {boolean} isVisible - Specifies if the sheet is visible or not.
 */
ApiWorksheet.prototype.SetVisible = function (isVisible) {};

/**
 * Sets the state of sheet visibility.
 * @memberof ApiWorksheet
 * @param {boolean} isVisible - Specifies if the sheet is visible or not.
 */
ApiWorksheet.prototype.Visible = ApiWorksheet.prototype.SetVisible ();

/**
 * Makes the current sheet active.
 * @memberof ApiWorksheet
 */
ApiWorksheet.prototype.SetActive = function () {};

/**
 * Makes the current sheet active.
 * @memberof ApiWorksheet
 */
ApiWorksheet.prototype.Active = ApiWorksheet.prototype.SetActive ();

/**
 * Returns an object that represents an active cell.
 * @memberof ApiWorksheet
 * @returns {ApiRange}
 */
ApiWorksheet.prototype.GetActiveCell = function () { return new ApiRange(); };

/**
 * Returns an object that represents an active cell.
 * @memberof ApiWorksheet
 * @returns {ApiRange}
 */
ApiWorksheet.prototype.ActiveCell = ApiWorksheet.prototype.GetActiveCell ();

/**
 * Returns an object that represents the selected range.
 * @memberof ApiWorksheet
 * @returns {ApiRange}
 */
ApiWorksheet.prototype.GetSelection = function () { return new ApiRange(); };

/**
 * Returns an object that represents the selected range.
 * @memberof ApiWorksheet
 * @returns {ApiRange}
 */
ApiWorksheet.prototype.Selection = ApiWorksheet.prototype.GetSelection ();

/**
 * Returns the ApiRange that represents all the cells on the worksheet (not just the cells that are currently in use).
 * @memberof ApiWorksheet
 * @param {number} row - The row number or the cell number (if only row is defined).
 * @param {number} col - The column number.
 * @returns {ApiRange | null}
 */
ApiWorksheet.prototype.GetCells = function (row, col) { return new ApiRange(); };

/**
 * Returns the ApiRange that represents all the cells on the worksheet (not just the cells that are currently in use).
 * @memberof ApiWorksheet
 * @param {number} row - The row number or the cell number (if only row is defined).
 * @param {number} col - The column number.
 * @returns {ApiRange | null}
 */
ApiWorksheet.prototype.Cells = ApiWorksheet.prototype.GetCells ();

/**
 * Returns the ApiRange object that represents all the cells on the rows range.
 * @memberof ApiWorksheet
 * @param {string | number} value - Specifies the rows range in the string or number format.
 * @returns {ApiRange | null}
 */
ApiWorksheet.prototype.GetRows = function (value) { return new ApiRange(); };

/**
 * Returns the ApiRange object that represents all the cells on the columns range.
 * @memberof ApiWorksheet
 * @param {string} sRange - Specifies the columns range in the string format.
 * @returns {ApiRange}
 */
ApiWorksheet.prototype.GetCols = function (sRange) { return new ApiRange(); };

/**
 * Returns the ApiRange object that represents all the cells on the columns range.
 * @memberof ApiWorksheet
 * @param {string} sRange - Specifies the columns range in the string format.
 * @returns {ApiRange}
 */
ApiWorksheet.prototype.Cols = ApiWorksheet.prototype.GetCols ();

/**
 * Returns the ApiRange object that represents the used range on the specified worksheet.
 * @memberof ApiWorksheet
 * @returns {ApiRange}
 */
ApiWorksheet.prototype.GetUsedRange = function () { return new ApiRange(); };

/**
 * Returns the ApiRange object that represents the used range on the specified worksheet.
 * @memberof ApiWorksheet
 * @returns {ApiRange}
 */
ApiWorksheet.prototype.UsedRange = ApiWorksheet.prototype.GetUsedRange ();

/**
 * Returns a sheet name.
 * @memberof ApiWorksheet
 * @returns {string}
 */
ApiWorksheet.prototype.GetName = function () { return ""; };

/**
 * Sets a name to the current active sheet.
 * @memberof ApiWorksheet
 * @param {string} sName - The name which will be displayed for the current sheet at the sheet tab.
 */
ApiWorksheet.prototype.SetName = function (sName) {};

/**
 * Sets a name to the current active sheet.
 * @memberof ApiWorksheet
 * @param {string} sName - The name which will be displayed for the current sheet at the sheet tab.
 */
ApiWorksheet.prototype.Name = ApiWorksheet.prototype.SetName ();

/**
 * Returns a sheet index.
 * @memberof ApiWorksheet
 * @returns {number}
 */
ApiWorksheet.prototype.GetIndex = function () { return 0; };

/**
 * Returns a sheet index.
 * @memberof ApiWorksheet
 * @returns {number}
 */
ApiWorksheet.prototype.Index = ApiWorksheet.prototype.GetIndex ();

/**
 * Returns an object that represents the selected range of the current sheet. Can be a single cell - <b>A1</b>, or cells
 * from a single row - <b>A1:E1</b>, or cells from a single column - <b>A1:A10</b>, or cells from several rows and columns - <b>A1:E10</b>.
 * @memberof ApiWorksheet
 * @param {string | ApiRange} Range1 - The range of cells from the current sheet.
 * @param {string | ApiRange} Range2 - The range of cells from the current sheet.
 * @returns {ApiRange | null} - returns null if such a range does not exist.
 */
ApiWorksheet.prototype.GetRange = function (Range1, Range2) { return new ApiRange(); };

/**
 * Returns an object that represents the selected range of the current sheet using the <b>row/column</b> coordinates for the cell selection.
 * @memberof ApiWorksheet
 * @param {number} nRow - The row number.
 * @param {number} nCol - The column number.
 * @returns {ApiRange}
 */
ApiWorksheet.prototype.GetRangeByNumber = function (nRow, nCol) { return new ApiRange(); };

/**
 * Formats the selected range of cells from the current sheet as a table (with the first row formatted as a header).
 * <note>As the first row is always formatted as a table header, you need to select at least two rows for the table to be formed correctly.</note>
 * @memberof ApiWorksheet
 * @param {string} sRange - The range of cells from the current sheet which will be formatted as a table.
 */
ApiWorksheet.prototype.FormatAsTable = function (sRange) {};

/**
 * Sets the width of the specified column.
 * One unit of column width is equal to the width of one character in the Normal style.
 * For proportional fonts, the width of the character 0 (zero) is used.
 * @memberof ApiWorksheet
 * @param {number} nColumn - The number of the column to set the width to.
 * @param {number} nWidth - The width of the column divided by 7 pixels.
 * @param {boolean} [bWithotPaddings=false] - Specifies whether nWidth will be set without standard paddings.
 */
ApiWorksheet.prototype.SetColumnWidth = function (nColumn, nWidth, bWithotPaddings) {};

/**
 * Sets the height of the specified row measured in points.
 * A point is 1/72 inch.
 * @memberof ApiWorksheet
 * @param {number} nRow - The number of the row to set the height to.
 * @param {number} nHeight - The height of the row measured in points.
 */
ApiWorksheet.prototype.SetRowHeight = function (nRow, nHeight) {};

/**
 * Specifies whether the current sheet gridlines must be displayed or not.
 * @memberof ApiWorksheet
 * @param {boolean} isDisplayed - Specifies whether the current sheet gridlines must be displayed or not. The default value is <b>true</b>.
 */
ApiWorksheet.prototype.SetDisplayGridlines = function (isDisplayed) {};

/**
 * Specifies whether the current sheet row/column headers must be displayed or not.
 * @memberof ApiWorksheet
 * @param {boolean} isDisplayed - Specifies whether the current sheet row/column headers must be displayed or not. The default value is <b>true</b>.
 */
ApiWorksheet.prototype.SetDisplayHeadings = function (isDisplayed) {};

/**
 * Sets the left margin of the sheet.
 * @memberof ApiWorksheet
 * @param {number} nPoints - The left margin size measured in points.
 */
ApiWorksheet.prototype.SetLeftMargin = function (nPoints) {};

/**
 * Returns the left margin of the sheet.
 * @memberof ApiWorksheet
 * @returns {number} - The left margin size measured in points.
 */
ApiWorksheet.prototype.GetLeftMargin = function () { return 0; };

/**
 * Returns the left margin of the sheet.
 * @memberof ApiWorksheet
 * @returns {number} - The left margin size measured in points.
 */
ApiWorksheet.prototype.LeftMargin = ApiWorksheet.prototype.GetLeftMargin ();

/**
 * Sets the right margin of the sheet.
 * @memberof ApiWorksheet
 * @param {number} nPoints - The right margin size measured in points.
 */
ApiWorksheet.prototype.SetRightMargin = function (nPoints) {};

/**
 * Returns the right margin of the sheet.
 * @memberof ApiWorksheet
 * @returns {number} - The right margin size measured in points.
 */
ApiWorksheet.prototype.GetRightMargin = function () { return 0; };

/**
 * Returns the right margin of the sheet.
 * @memberof ApiWorksheet
 * @returns {number} - The right margin size measured in points.
 */
ApiWorksheet.prototype.RightMargin = ApiWorksheet.prototype.GetRightMargin ();

/**
 * Sets the top margin of the sheet.
 * @memberof ApiWorksheet
 * @param {number} nPoints - The top margin size measured in points.
 */
ApiWorksheet.prototype.SetTopMargin = function (nPoints) {};

/**
 * Returns the top margin of the sheet.
 * @memberof ApiWorksheet
 * @returns {number} - The top margin size measured in points.
 */
ApiWorksheet.prototype.GetTopMargin = function () { return 0; };

/**
 * Returns the top margin of the sheet.
 * @memberof ApiWorksheet
 * @returns {number} - The top margin size measured in points.
 */
ApiWorksheet.prototype.TopMargin = ApiWorksheet.prototype.GetTopMargin ();

/**
 * Sets the bottom margin of the sheet.
 * @memberof ApiWorksheet
 * @param {number} nPoints - The bottom margin size measured in points.
 */
ApiWorksheet.prototype.SetBottomMargin = function (nPoints) {};

/**
 * Returns the bottom margin of the sheet.
 * @memberof ApiWorksheet
 * @returns {number} - The bottom margin size measured in points.
 */
ApiWorksheet.prototype.GetBottomMargin = function () { return 0; };

/**
 * Returns the bottom margin of the sheet.
 * @memberof ApiWorksheet
 * @returns {number} - The bottom margin size measured in points.
 */
ApiWorksheet.prototype.BottomMargin = ApiWorksheet.prototype.GetBottomMargin ();

/**
 * Sets the page orientation.
 * @memberof ApiWorksheet
 * @param {PageOrientation} sPageOrientation - The page orientation type.
 */
ApiWorksheet.prototype.SetPageOrientation = function (sPageOrientation) {};

/**
 * Returns the page orientation.
 * @memberof ApiWorksheet
 * @returns {PageOrientation}
 */
ApiWorksheet.prototype.GetPageOrientation = function () { return new PageOrientation(); };

/**
 * Returns the page orientation.
 * @memberof ApiWorksheet
 * @returns {PageOrientation}
 */
ApiWorksheet.prototype.PageOrientation = ApiWorksheet.prototype.GetPageOrientation ();

/**
 * Returns the page PrintHeadings property which specifies whether the current sheet row/column headings must be printed or not.
 * @memberof ApiWorksheet
 * @returns {boolean} - Specifies whether the current sheet row/column headings must be printed or not.
 */
ApiWorksheet.prototype.GetPrintHeadings = function () { return true; };

/**
 * Specifies whether the current sheet row/column headers must be printed or not.
 * @memberof ApiWorksheet
 * @param {boolean} bPrint - Specifies whether the current sheet row/column headers must be printed or not.
 */
ApiWorksheet.prototype.SetPrintHeadings = function (bPrint) {};

/**
 * Specifies whether the current sheet row/column headers must be printed or not.
 * @memberof ApiWorksheet
 * @param {boolean} bPrint - Specifies whether the current sheet row/column headers must be printed or not.
 */
ApiWorksheet.prototype.PrintHeadings = ApiWorksheet.prototype.SetPrintHeadings ();

/**
 * Returns the page PrintGridlines property which specifies whether the current sheet gridlines must be printed or not.
 * @memberof ApiWorksheet
 * @returns {boolean} - True if cell gridlines are printed on this page.
 */
ApiWorksheet.prototype.GetPrintGridlines = function () { return true; };

/**
 * Specifies whether the current sheet gridlines must be printed or not.
 * @memberof ApiWorksheet
 * @param {boolean} bPrint - Defines if cell gridlines are printed on this page or not.
 */
ApiWorksheet.prototype.SetPrintGridlines = function (bPrint) {};

/**
 * Specifies whether the current sheet gridlines must be printed or not.
 * @memberof ApiWorksheet
 * @param {boolean} bPrint - Defines if cell gridlines are printed on this page or not.
 */
ApiWorksheet.prototype.PrintGridlines = ApiWorksheet.prototype.SetPrintGridlines ();

/**
 * Returns an array of ApiName objects.
 * @memberof ApiWorksheet
 * @returns {ApiName[]}
 */
ApiWorksheet.prototype.GetDefNames = function () { return [new ApiName()]; };

/**
 * Returns the ApiName object by the worksheet name.
 * @memberof ApiWorksheet
 * @param {string} defName - The worksheet name.
 * @returns {ApiName | null} - returns null if definition name doesn't exist.
 */
ApiWorksheet.prototype.GetDefName = function (defName) { return new ApiName(); };

/**
 * Adds a new name to the current worksheet.
 * @memberof ApiWorksheet
 * @param {string} sName - The range name.
 * @param {string} sRef  - Must contain the sheet name, followed by sign ! and a range of cells.
 * Example: "Sheet1!$A$1:$B$2".
 * @param {boolean} isHidden - Defines if the range name is hidden or not.
 * @returns {boolean} - returns false if sName or sRef are invalid.
 */
ApiWorksheet.prototype.AddDefName = function (sName, sRef, isHidden) { return true; };

/**
 * Adds a new name to the current worksheet.
 * @memberof ApiWorksheet
 * @param {string} sName - The range name.
 * @param {string} sRef  - Must contain the sheet name, followed by sign ! and a range of cells.
 * Example: "Sheet1!$A$1:$B$2".
 * @param {boolean} isHidden - Defines if the range name is hidden or not.
 * @returns {boolean} - returns false if sName or sRef are invalid.
 */
ApiWorksheet.prototype.DefNames = ApiWorksheet.prototype.AddDefName ();

/**
 * Returns all comments from the current worksheet.
 * @memberof ApiWorksheet
 * @returns {ApiComment[]}
 */
ApiWorksheet.prototype.GetComments = function () { return [new ApiComment()]; };

/**
 * Returns all comments from the current worksheet.
 * @memberof ApiWorksheet
 * @returns {ApiComment[]}
 */
ApiWorksheet.prototype.Comments = ApiWorksheet.prototype.GetComments ();

/**
 * Deletes the current worksheet.
 * @memberof ApiWorksheet
 */
ApiWorksheet.prototype.Delete = function () {};

/**
 * Adds a hyperlink to the specified range.
 * @memberof ApiWorksheet
 * @param {string} sRange - The range where the hyperlink will be added to.
 * @param {string} sAddress - The link address.
 * @param {string} [subAddress] - The link subaddress to insert internal sheet hyperlinks.
 * @param {string} [sScreenTip] - The screen tip text.
 * @param {string} [sTextToDisplay] - The link text that will be displayed on the sheet.
 */
ApiWorksheet.prototype.SetHyperlink = function (sRange, sAddress, subAddress, sScreenTip, sTextToDisplay) {};

/**
 * Creates a chart of the specified type from the selected data range of the current sheet.
 * <note>Please note that the horizontal and vertical offsets are calculated within the limits of the specified column and
 * row cells only. If this value exceeds the cell width or height, another vertical/horizontal position will be set.</note>
 * @memberof ApiWorksheet
 * @param {string} sDataRange - The selected cell range which will be used to get the data for the chart, formed specifically and including the sheet name.
 * @param {boolean} bInRows - Specifies whether to take the data from the rows or from the columns. If true, the data from the rows will be used.
 * @param {ChartType} sType - The chart type used for the chart display.
 * @param {number} nStyleIndex - The chart color style index (can be <b>1 - 48</b>, as described in OOXML specification).
 * @param {EMU} nExtX - The chart width in English measure units
 * @param {EMU} nExtY - The chart height in English measure units.
 * @param {number} nFromCol - The number of the column where the beginning of the chart will be placed.
 * @param {EMU} nColOffset - The offset from the nFromCol column to the left part of the chart measured in English measure units.
 * @param {number} nFromRow - The number of the row where the beginning of the chart will be placed.
 * @param {EMU} nRowOffset - The offset from the nFromRow row to the upper part of the chart measured in English measure units.
 * @returns {ApiChart}
 */
ApiWorksheet.prototype.AddChart = function (sDataRange, bInRows, sType, nStyleIndex, nExtX, nExtY, nFromCol, nColOffset, nFromRow, nRowOffset) { return new ApiChart(); };

/**
 * Adds a shape to the current sheet with the parameters specified.
 * <note>Please note that the horizontal and vertical offsets are
 * calculated within the limits of the specified column and row cells
 * only. If this value exceeds the cell width or height, another vertical/horizontal position will be set.</note>
 * @memberof ApiWorksheet
 * @param {ShapeType} [sType="rect"] - The shape type which specifies the preset shape geometry.
 * @param {EMU} nWidth - The shape width in English measure units.
 * @param {EMU} nHeight - The shape height in English measure units.
 * @param {ApiFill} oFill - The color or pattern used to fill the shape.
 * @param {ApiStroke} oStroke - The stroke used to create the element shadow.
 * @param {number} nFromCol - The number of the column where the beginning of the shape will be placed.
 * @param {EMU} nColOffset - The offset from the nFromCol column to the left part of the shape measured in English measure units.
 * @param {number} nFromRow - The number of the row where the beginning of the shape will be placed.
 * @param {EMU} nRowOffset - The offset from the nFromRow row to the upper part of the shape measured in English measure units.
 * @returns {ApiShape}
 */
ApiWorksheet.prototype.AddShape = function (sType, nWidth, nHeight, oFill, oStroke, nFromCol, nColOffset, nFromRow, nRowOffset) { return new ApiShape(); };

/**
 * Adds an image to the current sheet with the parameters specified.
 * @memberof ApiWorksheet
 * @param {string} sImageSrc - The image source where the image to be inserted should be taken from (currently only internet URL or Base64 encoded images are supported).
 * @param {EMU} nWidth - The image width in English measure units.
 * @param {EMU} nHeight - The image height in English measure units.
 * @param {number} nFromCol - The number of the column where the beginning of the image will be placed.
 * @param {EMU} nColOffset - The offset from the nFromCol column to the left part of the image measured in English measure units.
 * @param {number} nFromRow - The number of the row where the beginning of the image will be placed.
 * @param {EMU} nRowOffset - The offset from the nFromRow row to the upper part of the image measured in English measure units.
 * @returns {ApiImage}
 */
ApiWorksheet.prototype.AddImage = function (sImageSrc, nWidth, nHeight, nFromCol, nColOffset, nFromRow, nRowOffset) { return new ApiImage(); };

/**
 * Adds a Text Art object to the current sheet with the parameters specified.
 * @memberof ApiWorksheet
 * @param {ApiTextPr} [oTextPr=Api.CreateTextPr()] - The text properties.
 * @param {string} [sText="Your text here"] - The text for the Text Art object.
 * @param {TextTransform} [sTransform="textNoShape"] - Text transform type.
 * @param {ApiFill} [oFill=Api.CreateNoFill()] - The color or pattern used to fill the Text Art object.
 * @param {ApiStroke} [oStroke=Api.CreateStroke(0, Api.CreateNoFill())] - The stroke used to create the Text Art object shadow.
 * @param {number} [nRotAngle=0] - Rotation angle.
 * @param {EMU} [nWidth=1828800] - The Text Art width measured in English measure units.
 * @param {EMU} [nHeight=1828800] - The Text Art heigth measured in English measure units.
 * @param {number} [nFromCol=0] - The column number where the beginning of the Text Art object will be placed.
 * @param {number} [nFromRow=0] - The row number where the beginning of the Text Art object will be placed.
 * @param {EMU} [nColOffset=0] - The offset from the nFromCol column to the left part of the Text Art object measured in English measure units.
 * @param {EMU} [nRowOffset=0] - The offset from the nFromRow row to the upper part of the Text Art object measured in English measure units.
 * @returns {ApiDrawing}
 */
ApiWorksheet.prototype.AddWordArt = function (oTextPr, sText, sTransform, oFill, oStroke, nRotAngle, nWidth, nHeight, nFromCol, nFromRow, nColOffset, nRowOffset) { return new ApiDrawing(); };

/**
 * Adds an OLE object to the current sheet with the parameters specified.
 * @memberof ApiWorksheet
 * @param {string} sImageSrc - The image source where the image to be inserted should be taken from (currently, only internet URL or Base64 encoded images are supported).
 * @param {EMU} nWidth - The OLE object width in English measure units.
 * @param {EMU} nHeight - The OLE object height in English measure units.
 * @param {string} sData - The OLE object string data.
 * @param {string} sAppId - The application ID associated with the current OLE object.
 * @param {number} nFromCol - The number of the column where the beginning of the OLE object will be placed.
 * @param {EMU} nColOffset - The offset from the nFromCol column to the left part of the OLE object measured in English measure units.
 * @param {number} nFromRow - The number of the row where the beginning of the OLE object will be placed.
 * @param {EMU} nRowOffset - The offset from the nFromRow row to the upper part of the OLE object measured in English measure units.
 * @returns {ApiOleObject}
 */
ApiWorksheet.prototype.AddOleObject = function (sImageSrc, nWidth, nHeight, sData, sAppId, nFromCol, nColOffset, nFromRow, nRowOffset) { return new ApiOleObject(); };

/**
 * Replaces the current image with a new one.
 * @memberof ApiWorksheet
 * @param {string} sImageUrl - The image source where the image to be inserted should be taken from (currently only internet URL or Base64 encoded images are supported).
 * @param {EMU} nWidth - The image width in English measure units.
 * @param {EMU} nHeight - The image height in English measure units.
 */
ApiWorksheet.prototype.ReplaceCurrentImage = function (sImageUrl, nWidth, nHeight) {};

/**
 * Returns all drawings from the current sheet.
 * @memberof ApiWorksheet
 * @returns {Drawing[]}.
 */
ApiWorksheet.prototype.GetAllDrawings = function () { return [new Drawing()]; };

/**
 * Returns all images from the current sheet.
 * @memberof ApiWorksheet
 * @returns {ApiImage[]}.
 */
ApiWorksheet.prototype.GetAllImages = function () { return [new ApiImage()]; };

/**
 * Returns all shapes from the current sheet.
 * @memberof ApiWorksheet
 * @returns {ApiShape[]}.
 */
ApiWorksheet.prototype.GetAllShapes = function () { return [new ApiShape()]; };

/**
 * Returns all charts from the current sheet.
 * @memberof ApiWorksheet
 * @returns {ApiChart[]}.
 */
ApiWorksheet.prototype.GetAllCharts = function () { return [new ApiChart()]; };

/**
 * Returns all OLE objects from the current sheet.
 * @memberof ApiWorksheet
 * @returns {ApiOleObject[]}.
 */
ApiWorksheet.prototype.GetAllOleObjects = function () { return [new ApiOleObject()]; };

/**
 * Moves the current sheet to another location in the workbook.
 * @memberof ApiWorksheet
 * @param {ApiWorksheet} before - The sheet before which the current sheet will be placed. You cannot specify "before" if you specify "after".
 * @param {ApiWorksheet} after - The sheet after which the current sheet will be placed. You cannot specify "after" if you specify "before".
 */
ApiWorksheet.prototype.Move = function (before, after) {};

/**
 * Returns a pivot table by its name from the current worksheet, or null if it does not exist.
 * @memberof ApiWorksheet
 * @param {string} name - The pivot table name.
 * @returns {ApiPivotTable|null}
 * @since 8.2.0
 */
ApiWorksheet.prototype.GetPivotByName = function (name) { return new ApiPivotTable(); };

/**
 * Returns all pivot tables from the current worksheet.
 * @memberof ApiWorksheet
 * @returns {ApiPivotTable[]}
 * @since 8.2.0
 */
ApiWorksheet.prototype.GetAllPivotTables = function () { return [new ApiPivotTable()]; };

/**
 * Returns all pivot tables from the current worksheet.
 * @memberof ApiWorksheet
 * @returns {ApiPivotTable[]}
 * @since 8.2.0
 */
ApiWorksheet.prototype.PivotTables = ApiWorksheet.prototype.GetAllPivotTables ();

/**
 * Refreshes all pivot tables on the current worksheet.
 * @memberof ApiWorksheet
 * @since 8.2.0
 */
ApiWorksheet.prototype.RefreshAllPivots = function () {};

/**
 * Returns the freeze panes from the current worksheet.
 * @memberof ApiWorksheet
 * @returns {ApiFreezePanes}
 * @since 8.0.0
 */
ApiWorksheet.prototype.GetFreezePanes = function () { return new ApiFreezePanes(); };

/**
 * Returns the freeze panes from the current worksheet.
 * @memberof ApiWorksheet
 * @returns {ApiFreezePanes}
 * @since 8.0.0
 */
ApiWorksheet.prototype.FreezePanes = ApiWorksheet.prototype.GetFreezePanes ();

/**
 * Creates a protected range of the specified type from the selected data range of the current sheet.
 * @memberof ApiWorksheet
 * @param {string} sTitle - The title which will be displayed for the current protected range.
 * @param {string} sDataRange - The selected cell range which will be used to get the data for the protected range.
 * @returns {ApiProtectedRange | null}
 * @since 8.1.0
 */
ApiWorksheet.prototype.AddProtectedRange = function (sTitle, sDataRange) { return new ApiProtectedRange(); };

/**
 * Returns a protected range object by its title.
 * @memberof ApiWorksheet
 * @param {string} sTitle - The title of the protected range that will be returned.
 * @returns {ApiProtectedRange | null}
 * @since 8.1.0
 */
ApiWorksheet.prototype.GetProtectedRange = function (sTitle) { return new ApiProtectedRange(); };

/**
 * Returns all protected ranges from the current worksheet.
 * @memberof ApiWorksheet
 * @returns {ApiProtectedRange[] | null}
 * @since 8.1.0
 */
ApiWorksheet.prototype.GetAllProtectedRanges = function () { return [new ApiProtectedRange()]; };

/**
 * Returns all protected ranges from the current worksheet.
 * @memberof ApiWorksheet
 * @returns {ApiProtectedRange[] | null}
 * @since 8.1.0
 */
ApiWorksheet.prototype.AllProtectedRanges = ApiWorksheet.prototype.GetAllProtectedRanges ();

/**
 * Pastes the contents of the clipboard to the current sheet.
 * @memberof ApiWorksheet
 * @param {ApiRange} [destination] - The cell range where the clipboard contents should be pasted. If this argument is omitted, the current selection is used.
 * @since 8.1.0
 */
ApiWorksheet.prototype.Paste = function (destination) {};

/**
 * Retrieves the custom XML manager associated with the current sheet.
 * This manager allows manipulation and access to custom XML parts within the current sheet.
 * @memberof ApiWorksheet
 * @since 9.1.0
 * @returns {ApiCustomXmlParts|null} Returns an instance of ApiCustomXmlParts if the custom XML manager exists, otherwise returns null.
 */
ApiWorksheet.prototype.GetCustomXmlParts = function(){ return new ApiCustomXmlParts(); };

/**
 * Specifies the cell border position.
 * @typedef {("DiagonalDown" | "DiagonalUp" | "Bottom" | "Left" | "Right" | "Top" | "InsideHorizontal" | "InsideVertical")} BordersIndex
 */

/**
 * Specifies the line style used to form the cell border.
 * @typedef {("None" | "Double" | "Hair" | "DashDotDot" | "DashDot" | "Dotted" | "Dashed" | "Thin" | "MediumDashDotDot" | "SlantDashDot" | "MediumDashDot" | "MediumDashed" | "Medium" | "Thick")} LineStyle
 */

/**
 * Specifies the sort order.
 * @typedef {("xlAscending" | "xlDescending")}  SortOrder
 */

/**
 * Specifies whether the first row of the sort range contains the header information.
 * @typedef {("xlNo" | "xlYes")} SortHeader
 */

/**
 * Specifies if the sort should be by row or column.
 * @typedef {("xlSortColumns" | "xlSortRows")} SortOrientation
 */

/**
 * Specifies the range angle.
 * @typedef {("xlDownward" | "xlHorizontal" | "xlUpward" | "xlVertical")} Angle
 */

/**
 * Specifies the direction of end in the specified range.
 * @typedef {("xlUp" | "xlDown" | "xlToRight" | "xlToLeft")} Direction
 */

/**
 * Returns a type of the ApiRange class.
 * @memberof ApiRange
 * @returns {"range"}
 */
ApiRange.prototype.GetClassType = function () { return ""; };

/**
 * Returns a row number for the selected cell.
 * @memberof ApiRange
 * @returns {number}
 */
ApiRange.prototype.GetRow = function () { return 0; };

/**
 * Returns a row number for the selected cell.
 * @memberof ApiRange
 * @returns {number}
 */
ApiRange.prototype.Row = ApiRange.prototype.GetRow ();

/**
 * Returns a column number for the selected cell.
 * @memberof ApiRange
 * @returns {number}
 */
ApiRange.prototype.GetCol = function () { return 0; };

/**
 * Returns a column number for the selected cell.
 * @memberof ApiRange
 * @returns {number}
 */
ApiRange.prototype.Col = ApiRange.prototype.GetCol ();

/**
 * Clears the current range.
 * @memberof ApiRange
 */
ApiRange.prototype.Clear = function () {};

/**
 * Returns a Range object that represents the rows in the specified range. If the specified row is outside the Range object, a new Range will be returned that represents the cells between the columns of the original range in the specified row.
 * @memberof ApiRange
 * @param {number} nRow - The row number (starts counting from 1, the 0 value returns an error).
 * @returns {ApiRange | null}
 */
ApiRange.prototype.GetRows = function (nRow) { return new ApiRange(); };

/**
 * Returns a Range object that represents the rows in the specified range. If the specified row is outside the Range object, a new Range will be returned that represents the cells between the columns of the original range in the specified row.
 * @memberof ApiRange
 * @param {number} nRow - The row number (starts counting from 1, the 0 value returns an error).
 * @returns {ApiRange | null}
 */
ApiRange.prototype.Rows = ApiRange.prototype.GetRows ();

/**
 * Returns a Range object that represents the columns in the specified range.
 * @memberof ApiRange
 * @param {number} nCol - The column number. *
 * @returns {ApiRange | null}
 */
ApiRange.prototype.GetCols = function (nCol) { return new ApiRange(); };

/**
 * Returns a Range object that represents the columns in the specified range.
 * @memberof ApiRange
 * @param {number} nCol - The column number. *
 * @returns {ApiRange | null}
 */
ApiRange.prototype.Cols = ApiRange.prototype.GetCols ();

/**
 * Returns a Range object that represents the end in the specified direction in the specified range.
 * @memberof ApiRange
 * @param {Direction} direction - The direction of end in the specified range. *
 * @returns {ApiRange}
 */
ApiRange.prototype.End = function (direction) { return new ApiRange(); };

/**
 * Returns a Range object that represents all the cells in the specified range or a specified cell.
 * @memberof ApiRange
 * @param {number} row - The row number or the cell number (if only row is defined).
 * @param {number} col - The column number.
 * @returns {ApiRange}
 */
ApiRange.prototype.GetCells = function (row, col) { return new ApiRange(); };

/**
 * Returns a Range object that represents all the cells in the specified range or a specified cell.
 * @memberof ApiRange
 * @param {number} row - The row number or the cell number (if only row is defined).
 * @param {number} col - The column number.
 * @returns {ApiRange}
 */
ApiRange.prototype.Cells = ApiRange.prototype.GetCells ();

/**
 * Sets the cell offset.
 * @memberof ApiRange
 * @param {number} nRow - The row number.
 * @param {number} nCol - The column number.
 */
ApiRange.prototype.SetOffset = function (nRow, nCol) {};

/**
 * Returns the range address.
 * @memberof ApiRange
 * @param {boolean} RowAbs - Defines if the link to the row is absolute or not.
 * @param {boolean} ColAbs - Defines if the link to the column is absolute or not.
 * @param {string} RefStyle - The reference style.
 * @param {boolean} External - Defines if the range is in the current file or not.
 * @param {ApiRange} RelativeTo - The range which the current range is relative to.
 * @returns {string | null} - returns address of range as string.
 */
ApiRange.prototype.GetAddress = function (RowAbs, ColAbs, RefStyle, External, RelativeTo) { return ""; };

/**
 * Returns the range address.
 * @memberof ApiRange
 * @param {boolean} RowAbs - Defines if the link to the row is absolute or not.
 * @param {boolean} ColAbs - Defines if the link to the column is absolute or not.
 * @param {string} RefStyle - The reference style.
 * @param {boolean} External - Defines if the range is in the current file or not.
 * @param {ApiRange} RelativeTo - The range which the current range is relative to.
 * @returns {string | null} - returns address of range as string.
 */
ApiRange.prototype.Address = ApiRange.prototype.GetAddress ();

/**
 * Returns the rows or columns count.
 * @memberof ApiRange
 * @returns {number}
 */
ApiRange.prototype.GetCount = function () { return 0; };

/**
 * Returns the rows or columns count.
 * @memberof ApiRange
 * @returns {number}
 */
ApiRange.prototype.Count = ApiRange.prototype.GetCount ();

/**
 * Returns a value of the specified range.
 * @memberof ApiRange
 * @returns {string | string[][]}
 */
ApiRange.prototype.GetValue = function () { return [""]; };

/**
 * Sets a value to the current cell or cell range.
 * @memberof ApiRange
 * @param {string | boolean | number | Array<string | boolean | number> | Array<Array<string | boolean | number>>} data - The general value for the cell or cell range.
 * @returns {boolean} - returns false if such a range does not exist.
 */
ApiRange.prototype.SetValue = function (data) { return true; };

/**
 * Sets a value to the current cell or cell range.
 * @memberof ApiRange
 * @param {string | boolean | number | Array<string | boolean | number> | Array<Array<string | boolean | number>>} data - The general value for the cell or cell range.
 * @returns {boolean} - returns false if such a range does not exist.
 */
ApiRange.prototype.Value = ApiRange.prototype.SetValue ();

/**
 * Returns a formula of the specified range.
 * @memberof ApiRange
 * @returns {string | string[][]} - return Value2 property (value without format) if formula doesn't exist.
 */
ApiRange.prototype.GetFormula = function () { return [""]; };

/**
 * Returns a formula of the specified range.
 * @memberof ApiRange
 * @returns {string | string[][]} - return Value2 property (value without format) if formula doesn't exist.
 */
ApiRange.prototype.Formula = ApiRange.prototype.GetFormula ();

/**
 * Returns the Value2 property (value without format) of the specified range.
 * @memberof ApiRange
 * @returns {string | string[][]}
 */
ApiRange.prototype.GetValue2 = function () { return [""]; };

/**
 * Returns the Value2 property (value without format) of the specified range.
 * @memberof ApiRange
 * @returns {string | string[][]}
 */
ApiRange.prototype.Value2 = ApiRange.prototype.GetValue2 ();

/**
 * Returns the text of the specified range.
 * @memberof ApiRange
 * @returns {string | string[][]}
 */
ApiRange.prototype.GetText = function () { return [""]; };

/**
 * Returns the text of the specified range.
 * @memberof ApiRange
 * @returns {string | string[][]}
 */
ApiRange.prototype.Text = ApiRange.prototype.GetText ();

/**
 * Sets the text color to the current cell range with the previously created color object.
 * @memberof ApiRange
 * @param {ApiColor} oColor - The color object which specifies the color to be set to the text in the cell / cell range.
 */
ApiRange.prototype.SetFontColor = function (oColor) {};

/**
 * Sets the text color to the current cell range with the previously created color object.
 * @memberof ApiRange
 * @param {ApiColor} oColor - The color object which specifies the color to be set to the text in the cell / cell range.
 */
ApiRange.prototype.FontColor = ApiRange.prototype.SetFontColor ();

/**
 * Returns the value hiding property. The specified range must span an entire column or row.
 * @memberof ApiRange
 * @returns {boolean} - returns true if the values in the range specified are hidden.
 */
ApiRange.prototype.GetHidden = function () { return true; };

/**
 * Sets the value hiding property. The specified range must span an entire column or row.
 * @memberof ApiRange
 * @param {boolean} isHidden - Specifies if the values in the current range are hidden or not.
 */
ApiRange.prototype.SetHidden = function (isHidden) {};

/**
 * Sets the value hiding property. The specified range must span an entire column or row.
 * @memberof ApiRange
 * @param {boolean} isHidden - Specifies if the values in the current range are hidden or not.
 */
ApiRange.prototype.Hidden = ApiRange.prototype.SetHidden ();

/**
 * Returns the column width value.
 * @memberof ApiRange
 * @returns {number}
 */
ApiRange.prototype.GetColumnWidth = function () { return 0; };

/**
 * Sets the width of all the columns in the current range.
 * One unit of column width is equal to the width of one character in the Normal style.
 * For proportional fonts, the width of the character 0 (zero) is used.
 * @memberof ApiRange
 * @param {number} nWidth - The width of the column divided by 7 pixels.
 */
ApiRange.prototype.SetColumnWidth = function (nWidth) {};

/**
 * Sets the width of all the columns in the current range.
 * One unit of column width is equal to the width of one character in the Normal style.
 * For proportional fonts, the width of the character 0 (zero) is used.
 * @memberof ApiRange
 * @param {number} nWidth - The width of the column divided by 7 pixels.
 */
ApiRange.prototype.ColumnWidth = ApiRange.prototype.SetColumnWidth ();

/**
 * Returns the row height value.
 * @memberof ApiRange
 * @returns {pt} - The row height in the range specified, measured in points.
 */
ApiRange.prototype.GetRowHeight = function () { return new pt(); };

/**
 * Sets the row height value.
 * @memberof ApiRange
 * @param {pt} nHeight - The row height in the current range measured in points.
 */
ApiRange.prototype.SetRowHeight = function (nHeight) {};

/**
 * Sets the row height value.
 * @memberof ApiRange
 * @param {pt} nHeight - The row height in the current range measured in points.
 */
ApiRange.prototype.RowHeight = ApiRange.prototype.SetRowHeight ();

/**
 * Sets the font size to the characters of the current cell range.
 * @memberof ApiRange
 * @param {number} nSize - The font size value measured in points.
 */
ApiRange.prototype.SetFontSize = function (nSize) {};

/**
 * Sets the font size to the characters of the current cell range.
 * @memberof ApiRange
 * @param {number} nSize - The font size value measured in points.
 */
ApiRange.prototype.FontSize = ApiRange.prototype.SetFontSize ();

/**
 * Sets the specified font family as the font name for the current cell range.
 * @memberof ApiRange
 * @param {string} sName - The font family name used for the current cell range.
 */
ApiRange.prototype.SetFontName = function (sName) {};

/**
 * Sets the specified font family as the font name for the current cell range.
 * @memberof ApiRange
 * @param {string} sName - The font family name used for the current cell range.
 */
ApiRange.prototype.FontName = ApiRange.prototype.SetFontName ();

/**
 * Sets the vertical alignment of the text in the current cell range.
 * @memberof ApiRange
 * @param {'center' | 'bottom' | 'top' | 'distributed' | 'justify'} sAligment - The vertical alignment that will be applied to the cell contents.
 * @returns {boolean} - return false if sAligment doesn't exist.
 */
ApiRange.prototype.SetAlignVertical = function (sAligment) { return true; };

/**
 * Sets the vertical alignment of the text in the current cell range.
 * @memberof ApiRange
 * @param {'center' | 'bottom' | 'top' | 'distributed' | 'justify'} sAligment - The vertical alignment that will be applied to the cell contents.
 * @returns {boolean} - return false if sAligment doesn't exist.
 */
ApiRange.prototype.AlignVertical = ApiRange.prototype.SetAlignVertical ();

/**
 * Sets the horizontal alignment of the text in the current cell range.
 * @memberof ApiRange
 * @param {'left' | 'right' | 'center' | 'justify'} sAlignment - The horizontal alignment that will be applied to the cell contents.
 * @returns {boolean} - return false if sAligment doesn't exist.
 */
ApiRange.prototype.SetAlignHorizontal = function (sAlignment) { return true; };

/**
 * Sets the horizontal alignment of the text in the current cell range.
 * @memberof ApiRange
 * @param {'left' | 'right' | 'center' | 'justify'} sAlignment - The horizontal alignment that will be applied to the cell contents.
 * @returns {boolean} - return false if sAligment doesn't exist.
 */
ApiRange.prototype.AlignHorizontal = ApiRange.prototype.SetAlignHorizontal ();

/**
 * Sets the direction (reading order) of the text in the current cell range.
 *
 * @memberof ApiRange
 * @param {'context' | 'ltr' | 'rtl'} direction - The direction (reading order) that will be applied to the cell contents.
 */
ApiRange.prototype.SetReadingOrder = function (direction) {};

/**
 * Sets the direction (reading order) of the text in the current cell range.
 *
 * @memberof ApiRange
 * @param {'context' | 'ltr' | 'rtl'} direction - The direction (reading order) that will be applied to the cell contents.
 */
ApiRange.prototype.ReadingOrder = ApiRange.prototype.SetReadingOrder ();

/**
 * Sets the bold property to the text characters in the current cell or cell range.
 * @memberof ApiRange
 * @param {boolean} isBold - Specifies that the contents of the current cell / cell range are displayed bold.
 */
ApiRange.prototype.SetBold = function (isBold) {};

/**
 * Sets the bold property to the text characters in the current cell or cell range.
 * @memberof ApiRange
 * @param {boolean} isBold - Specifies that the contents of the current cell / cell range are displayed bold.
 */
ApiRange.prototype.Bold = ApiRange.prototype.SetBold ();

/**
 * Sets the italic property to the text characters in the current cell or cell range.
 * @memberof ApiRange
 * @param {boolean} isItalic - Specifies that the contents of the current cell / cell range are displayed italicized.
 */
ApiRange.prototype.SetItalic = function (isItalic) {};

/**
 * Sets the italic property to the text characters in the current cell or cell range.
 * @memberof ApiRange
 * @param {boolean} isItalic - Specifies that the contents of the current cell / cell range are displayed italicized.
 */
ApiRange.prototype.Italic = ApiRange.prototype.SetItalic ();

/**
 * Specifies that the contents of the current cell / cell range are displayed along with a line appearing directly below the character.
 * @memberof ApiRange
 * @param {'none' | 'single' | 'singleAccounting' | 'double' | 'doubleAccounting'} undelineType - Specifies the type of the
 * line displayed under the characters. The following values are available:
 * <b>"none"</b> - for no underlining;
 * <b>"single"</b> - for a single line underlining the cell contents;
 * <b>"singleAccounting"</b> - for a single line underlining the cell contents but not protruding beyond the cell borders;
 * <b>"double"</b> - for a double line underlining the cell contents;
 * <b>"doubleAccounting"</b> - for a double line underlining the cell contents but not protruding beyond the cell borders.
 */
ApiRange.prototype.SetUnderline = function (undelineType) {};

/**
 * Specifies that the contents of the current cell / cell range are displayed along with a line appearing directly below the character.
 * @memberof ApiRange
 * @param {'none' | 'single' | 'singleAccounting' | 'double' | 'doubleAccounting'} undelineType - Specifies the type of the
 * line displayed under the characters. The following values are available:
 * <b>"none"</b> - for no underlining;
 * <b>"single"</b> - for a single line underlining the cell contents;
 * <b>"singleAccounting"</b> - for a single line underlining the cell contents but not protruding beyond the cell borders;
 * <b>"double"</b> - for a double line underlining the cell contents;
 * <b>"doubleAccounting"</b> - for a double line underlining the cell contents but not protruding beyond the cell borders.
 */
ApiRange.prototype.Underline = ApiRange.prototype.SetUnderline ();

/**
 * Specifies that the contents of the cell / cell range are displayed with a single horizontal line through the center of the contents.
 * @memberof ApiRange
 * @param {boolean} isStrikeout - Specifies if the contents of the current cell / cell range are displayed struck through.
 */
ApiRange.prototype.SetStrikeout = function (isStrikeout) {};

/**
 * Specifies that the contents of the cell / cell range are displayed with a single horizontal line through the center of the contents.
 * @memberof ApiRange
 * @param {boolean} isStrikeout - Specifies if the contents of the current cell / cell range are displayed struck through.
 */
ApiRange.prototype.Strikeout = ApiRange.prototype.SetStrikeout ();

/**
 * Specifies whether the words in the cell must be wrapped to fit the cell size or not.
 * @memberof ApiRange
 * @param {boolean} isWrap - Specifies if the words in the cell will be wrapped to fit the cell size.
 */
ApiRange.prototype.SetWrap = function (isWrap) {};

/**
 * Returns the information about the wrapping cell style.
 * @memberof ApiRange
 * @returns {boolean}
 */
ApiRange.prototype.GetWrapText = function () { return true; };

/**
 * Returns the information about the wrapping cell style.
 * @memberof ApiRange
 * @returns {boolean}
 */
ApiRange.prototype.WrapText = ApiRange.prototype.GetWrapText ();

/**
 * Sets the background color to the current cell range with the previously created color object.
 * Sets 'No Fill' when previously created color object is null.
 * @memberof ApiRange
 * @param {ApiColor} oColor - The color object which specifies the color to be set to the background in the cell / cell range.
 */
ApiRange.prototype.SetFillColor = function (oColor) {};

/**
 * Returns the background color for the current cell range. Returns 'No Fill' when the color of the background in the cell / cell range is null.
 * @memberof ApiRange
 * @returns {ApiColor|'No Fill'} - return 'No Fill' when the color to the background in the cell / cell range is null.
 */
ApiRange.prototype.GetFillColor = function () { return new ApiColor(); };

/**
 * Returns the background color for the current cell range. Returns 'No Fill' when the color of the background in the cell / cell range is null.
 * @memberof ApiRange
 * @returns {ApiColor|'No Fill'} - return 'No Fill' when the color to the background in the cell / cell range is null.
 */
ApiRange.prototype.FillColor = ApiRange.prototype.GetFillColor ();

/**
 * Returns a value that represents the format code for the current range.
 * @memberof ApiRange
 * @returns {string | null} This property returns null if all cells in the specified range don't have the same number format.
 */
ApiRange.prototype.GetNumberFormat = function () { return ""; };

/**
 * Specifies whether a number in the cell should be treated like number, currency, date, time, etc. or just like text.
 * @memberof ApiRange
 * @param {string} sFormat - Specifies the mask applied to the number in the cell.
 */
ApiRange.prototype.SetNumberFormat = function (sFormat) {};

/**
 * Specifies whether a number in the cell should be treated like number, currency, date, time, etc. or just like text.
 * @memberof ApiRange
 * @param {string} sFormat - Specifies the mask applied to the number in the cell.
 */
ApiRange.prototype.NumberFormat = ApiRange.prototype.SetNumberFormat ();

/**
 * Sets the border to the cell / cell range with the parameters specified.
 * @memberof ApiRange
 * @param {BordersIndex} bordersIndex - Specifies the cell border position.
 * @param {LineStyle} lineStyle - Specifies the line style used to form the cell border.
 * @param {ApiColor} oColor - The color object which specifies the color to be set to the cell border.
 */
ApiRange.prototype.SetBorders = function (bordersIndex, lineStyle, oColor) {};

/**
 * Merges the selected cell range into a single cell or a cell row.
 * @memberof ApiRange
 * @param {boolean} isAcross - When set to <b>true</b>, the cells within the selected range will be merged along the rows,
 * but remain split in the columns. When set to <b>false</b>, the whole selected range of cells will be merged into a single cell.
 */
ApiRange.prototype.Merge = function (isAcross) {};

/**
 * Splits the selected merged cell range into the single cells.
 * @memberof ApiRange
 */
ApiRange.prototype.UnMerge = function () {};

/**
 * Returns one cell or cells from the merge area.
 * @memberof ApiRange
 * @returns {ApiRange | null} - returns null if range isn't one cell
 */
result = new ApiRange((bb) ? AscCommonExcel.Range.prototype.createFromBBox(this.range.worksheet, bb) : this.range);{ return new ApiRange(); };

/**
 * Returns one cell or cells from the merge area.
 * @memberof ApiRange
 * @returns {ApiRange | null} - returns null if range isn't one cell
 */
ApiRange.prototype.MergeArea = new ApiRange();

/**
 * Executes a provided function once for each cell.
 * @memberof ApiRange
 * @param {Function} fCallback - A function which will be executed for each cell.
 */
ApiRange.prototype.ForEach = function (fCallback) {};

/**
 * Adds a comment to the current range.
 * @memberof ApiRange
 * @param {string} sText - The comment text.
 * @param {string} sAuthor - The author's name (optional).
 * @returns {ApiComment | null} - returns false if comment can't be added.
 */
ApiRange.prototype.AddComment = function (sText, sAuthor) { return new ApiComment(); };

/**
 * Returns the Worksheet object that represents the worksheet containing the specified range. It will be available in the read-only mode.
 * @memberof ApiRange
 * @returns {ApiWorksheet}
 */
ApiRange.prototype.GetWorksheet = function () { return new ApiWorksheet(); };

/**
 * Returns the Worksheet object that represents the worksheet containing the specified range. It will be available in the read-only mode.
 * @memberof ApiRange
 * @returns {ApiWorksheet}
 */
ApiRange.prototype.Worksheet = ApiRange.prototype.GetWorksheet ();

/**
 * Returns the ApiName object of the current range.
 * @memberof ApiRange
 * @returns {ApiName}
 */
ApiRange.prototype.GetDefName = function () { return new ApiName(); };

/**
 * Returns the ApiName object of the current range.
 * @memberof ApiRange
 * @returns {ApiName}
 */
ApiRange.prototype.DefName = ApiRange.prototype.GetDefName ();

/**
 * Returns the ApiComment object of the current range.
 * @memberof ApiRange
 * @returns {ApiComment | null} - returns null if range does not consist of one cell.
 */
ApiRange.prototype.GetComment = function () { return new ApiComment(); };

/**
 * Returns the ApiComment object of the current range.
 * @memberof ApiRange
 * @returns {ApiComment | null} - returns null if range does not consist of one cell.
 */
ApiRange.prototype.Comments = ApiRange.prototype.GetComment ();

/**
 * Selects the current range.
 * @memberof ApiRange
 */
ApiRange.prototype.Select = function () {};

/**
 * Returns the current range angle.
 * @memberof ApiRange
 * @returns {Angle}
 */
ApiRange.prototype.GetOrientation = function () { return new Angle(); };

/**
 * Sets an angle to the current cell range.
 * @memberof ApiRange
 * @param {Angle} angle - Specifies the range angle.
 */
ApiRange.prototype.SetOrientation = function (angle) {};

/**
 * Sets an angle to the current cell range.
 * @memberof ApiRange
 * @param {Angle} angle - Specifies the range angle.
 */
ApiRange.prototype.Orientation = ApiRange.prototype.SetOrientation ();

/**
 * Sorts the cells in the given range by the parameters specified in the request.
 * @memberof ApiRange
 * @param {ApiRange | String} key1 - First sort field.
 * @param {SortOrder} sSortOrder1 - The sort order for the values specified in Key1.
 * @param {ApiRange | String} key2 - Second sort field.
 * @param {SortOrder} sSortOrder2 - The sort order for the values specified in Key2.
 * @param {ApiRange | String} key3 - Third sort field.
 * @param {SortOrder} sSortOrder3 - The sort order for the values specified in Key3.
 * @param {SortHeader} sHeader - Specifies whether the first row contains header information.
 * @param {SortOrientation} sOrientation - Specifies if the sort should be by row (default) or column.
 */
ApiRange.prototype.SetSort = function (key1, sSortOrder1, key2, /*Type,*/ sSortOrder2, key3, sSortOrder3, sHeader, /*OrderCustom, MatchCase,*/ sOrientation/*, SortMethod, DataOption1, DataOption2, DataOption3*/) {};

/**
 * Sorts the cells in the given range by the parameters specified in the request.
 * @memberof ApiRange
 * @param {ApiRange | String} key1 - First sort field.
 * @param {SortOrder} sSortOrder1 - The sort order for the values specified in Key1.
 * @param {ApiRange | String} key2 - Second sort field.
 * @param {SortOrder} sSortOrder2 - The sort order for the values specified in Key2.
 * @param {ApiRange | String} key3 - Third sort field.
 * @param {SortOrder} sSortOrder3 - The sort order for the values specified in Key3.
 * @param {SortHeader} sHeader - Specifies whether the first row contains header information.
 * @param {SortOrientation} sOrientation - Specifies if the sort should be by row (default) or column.
 */
ApiRange.prototype.Sort = ApiRange.prototype.SetSort ();

/**
 * Deletes the Range object.
 * @memberof ApiRange
 * @param {DeleteShiftDirection} [shift] - Specifies how to shift cells to replace the deleted cells.
 */
ApiRange.prototype.Delete = function (shift) {};

/**
 * Inserts a cell or a range of cells into the worksheet or macro sheet and shifts other cells away to make space.
 * @memberof ApiRange
 * @param {string} [shift] - Specifies which way to shift the cells ("right", "down").
 */
ApiRange.prototype.Insert = function (shift) {};

/**
 * Changes the width of the columns or the height of the rows in the range to achieve the best fit.
 * @memberof ApiRange
 * @param {boolean} [bRows] - Specifies if the width of the columns will be autofit.
 * @param {boolean} [bCols] - Specifies if the height of the rows will be autofit.
 */
ApiRange.prototype.AutoFit = function (bRows, bCols) {};

/**
 * Returns a collection of the ranges.
 * @memberof ApiRange
 * @returns {ApiAreas}
 */
ApiRange.prototype.GetAreas = function () { return new ApiAreas(); };

/**
 * Returns a collection of the ranges.
 * @memberof ApiRange
 * @returns {ApiAreas}
 */
ApiRange.prototype.Areas = ApiRange.prototype.GetAreas ();

/**
 * Copies the range to the specified range or to the clipboard.
 * @memberof ApiRange
 * @param {ApiRange} [destination] - Specifies the new range to which the specified range will be copied. If this argument is omitted, the range will be copied to the clipboard.
 */
ApiRange.prototype.Copy = function (destination) {};

/**
 * Cuts the range and save it to the clipboard or paste it to the specified range.
 * @memberof ApiRange
 * @param {ApiRange} [destination] - Specifies the new range to which the cut range will be pasted. If this argument is omitted, the range will be copied to the clipboard.
 * @since 8.1.0
 */
ApiRange.prototype.Cut = function (destination) {};

/**
 * Pastes the Range object to the specified range.
 * @memberof ApiRange
 * @param {ApiRange} rangeFrom - Specifies the range to be pasted to the current range
 */
ApiRange.prototype.Paste = function (rangeFrom) {};

/**
 * Pastes the Range object to the specified range using the special paste options.
 * @memberof ApiRange
 * @param {PasteType} [sPasteType="xlPasteAll"]  - Paste option.
 * @param {PasteSpecialOperation} [sPasteSpecialOperation="xlPasteSpecialOperationNone"] - The mathematical operation which will be applied to the copied data.
 * @param {boolean} [bSkipBlanks=false] - Specifies whether to avoid replacing values in the paste area when blank cells occur in the copy area.
 * @param {boolean} [bTranspose=false] - Specifies whether the pasted data will be transposed from rows to columns.
 * @since 8.1.0
 */
ApiRange.prototype.PasteSpecial = function (sPasteType, sPasteSpecialOperation, bSkipBlanks, bTranspose) {};

/**
 * Returns the ApiPivotTable object that represents the pivot table report containing the upper-left corner of the specified range.
 * @memberof ApiRange
 * @returns {ApiPivotTable | null}
 * @since 8.2.0
 */
ApiRange.prototype.GetPivotTable = function() { return new ApiPivotTable(); };

/**
 * Returns the ApiPivotTable object that represents the pivot table report containing the upper-left corner of the specified range.
 * @memberof ApiRange
 * @returns {ApiPivotTable | null}
 * @since 8.2.0
 */
ApiRange.prototype.PivotTable = ApiRange.prototype.GetPivotTable ();

/**
 * Search data type (formulas or values).
 * @typedef {("xlFormulas" | "xlValues")} XlFindLookIn
 */

/**
 * Specifies whether the whole search text or any part of the search text is matched.
 * @typedef {("xlWhole" | "xlPart")} XlLookAt
 */

/**
 * Range search order - by rows or by columns.
 * @typedef {("xlByRows" | "xlByColumns")} XlSearchOrder
 */

/**
 * Range search direction - next match or previous match.
 * @typedef {("xlNext" | "xlPrevious")} XlSearchDirection
 */

/**
 * Properties to make search.
 * @typedef {Object} SearchData
 * @property {string | undefined} What - The data to search for.
 * @property {ApiRange} After - The cell after which you want the search to begin. If this argument is not specified, the search starts after the cell in the upper-left corner of the range.
 * @property {XlFindLookIn} LookIn - Search data type (formulas or values).
 * @property {XlLookAt} LookAt - Specifies whether the whole search text or any part of the search text is matched.
 * @property {XlSearchOrder} SearchOrder - Range search order - by rows or by columns.
 * @property {XlSearchDirection} SearchDirection - Range search direction - next match or previous match.
 * @property {boolean} MatchCase - Case sensitive or not. The default value is "false".
 */

/**
 * Properties to make search and replace.
 * @typedef {Object} ReplaceData
 * @property {string | undefined} What - The data to search for.
 * @property {string} Replacement - The replacement string.
 * @property {XlLookAt} LookAt - Specifies whether the whole search text or any part of the search text is matched.
 * @property {XlSearchOrder} SearchOrder - Range search order - by rows or by columns.
 * @property {XlSearchDirection} SearchDirection - Range search direction - next match or previous match.
 * @property {boolean} MatchCase - Case sensitive or not. The default value is "false".
 * @property {boolean} ReplaceAll - Specifies if all the found data will be replaced or not. The default value is "true".
 */

/**
 * Finds specific information in the current range.
 * @memberof ApiRange
 * @param {SearchData} oSearchData - The search data used to make search.
 * @returns {ApiRange | null} - Returns null if the current range does not contain such text.
 */
ApiRange.prototype.Find = function (oSearchData) { return new ApiRange(); };

/**
 * Continues a search that was begun with the {@link ApiRange#Find} method. Finds the next cell that matches those same conditions and returns the ApiRange object that represents that cell. This does not affect the selection or the active cell.
 * @memberof ApiRange
 * @param {ApiRange} After - The cell after which the search will start. If this argument is not specified, the search starts from the last cell found.
 * @returns {ApiRange | null} - Returns null if the range does not contain such text.
 *
 */
ApiRange.prototype.FindNext = function (After) { return new ApiRange(); };

/**
 * Continues a search that was begun with the {@link ApiRange#Find} method. Finds the previous cell that matches those same conditions and returns the ApiRange object that represents that cell. This does not affect the selection or the active cell.
 * @memberof ApiRange
 * @param {ApiRange} Before - The cell before which the search will start. If this argument is not specified, the search starts from the last cell found.
 * @returns {ApiRange | null} - Returns null if the range does not contain such text.
 *
 */
ApiRange.prototype.FindPrevious = function (Before) { return new ApiRange(); };

/**
 * Replaces specific information to another one in a range.
 * @memberof ApiRange
 * @param {ReplaceData} oReplaceData - The data used to make search and replace.
 * @returns {ApiRange | null} - Returns null if the current range does not contain such text.
 */
ApiRange.prototype.Replace = function (oReplaceData) { return new ApiRange(); };

/**
 * Returns the ApiCharacters object that represents a range of characters within the object text. Use the ApiCharacters object to format characters within a text string.
 * @memberof ApiRange
 * @param {number} Start - The first character to be returned. If this argument is either 1 or omitted, this property returns a range of characters starting with the first character.
 * @param {number} Length - The number of characters to be returned. If this argument is omitted, this property returns the remainder of the string (everything after the Start character).
 * @returns {ApiCharacters}
 * @since 7.4.0
 */
ApiRange.prototype.GetCharacters = function (Start, Length) { return new ApiCharacters(); };

/**
 * Returns the ApiCharacters object that represents a range of characters within the object text. Use the ApiCharacters object to format characters within a text string.
 * @memberof ApiRange
 * @param {number} Start - The first character to be returned. If this argument is either 1 or omitted, this property returns a range of characters starting with the first character.
 * @param {number} Length - The number of characters to be returned. If this argument is omitted, this property returns the remainder of the string (everything after the Start character).
 * @returns {ApiCharacters}
 * @since 7.4.0
 */
ApiRange.prototype.Characters = ApiRange.prototype.GetCharacters ();

/**
 * Filter type.
 * @typedef {("xlAnd" | "xlBottom10Items" | "xlBottom10Percent" | "xlFilterCellColor" | "xlFilterDynamic" | "xlFilterFontColor" | "xlFilterValues" | "xlOr" | "xlTop10Items" | "xlTop10Percent")} XlAutoFilterOperator
 */

/**
 * Specifies the filter criterion.
 * @typedef {("xlFilterAboveAverage" | "xlFilterAllDatesInPeriodApril" | "xlFilterAllDatesInPeriodAugust" | "xlFilterAllDatesInPeriodDecember"
 * | "xlFilterAllDatesInPeriodFebruary" | "xlFilterAllDatesInPeriodJanuary" | "xlFilterAllDatesInPeriodJuly" | "xlFilterAllDatesInPeriodJune"
 * | "xlFilterAllDatesInPeriodMarch" | "xlFilterAllDatesInPeriodMay" | "xlFilterAllDatesInPeriodNovember" | "xlFilterAllDatesInPeriodOctober"
 * | "xlFilterAllDatesInPeriodQuarter1" | "xlFilterAllDatesInPeriodQuarter2" | "xlFilterAllDatesInPeriodQuarter3" | "xlFilterAllDatesInPeriodQuarter4"
 * | "xlFilterBelowAverage" | "xlFilterLastMonth" | "xlFilterLastQuarter" | "xlFilterLastWeek"
 * | "xlFilterLastYear" | "xlFilterNextMonth" | "xlFilterNextQuarter" | "xlFilterNextWeek"
 * | "xlFilterNextYear" | "xlFilterThisMonth" | "xlFilterThisQuarter" | "xlFilterThisWeek"
 * | "xlFilterThisYear" | "xlFilterToday" | "xlFilterTomorrow" | "xlFilterYearToDate" | "xlFilterYesterday")} XlDynamicFilterCriteria
 */

/**
 * Adds an AutoFilter to the current range.
 * @memberof ApiRange
 * @param {number} [Field] - The integer offset of the field on which you want to base the filter (from the left of the list; the leftmost field is field one).
 * @param {string | string[] | ApiColor | XlDynamicFilterCriteria} [Criteria1] - The criteria (a string; for example, "101"). Use "=" to find blank fields, "<>" to find non-blank fields, and "><" to select (No Data) fields in data types.
 * If this argument is omitted, the criteria is All. If Operator is xlTop10Items, Criteria1 specifies the number of items (for example, "10").
 * @param {XlAutoFilterOperator} [Operator] - An XlAutoFilterOperator constant specifying the type of filter.
 * @param {string} [Criteria2] - The second criteria (a string). Used with Criteria1 and Operator to construct compound criteria.
 * @param {boolean} [VisibleDropDown] - True to display the AutoFilter drop-down arrow for the filtered field. False to hide the AutoFilter drop-down arrow for the filtered field. True by default.
 * @since 8.3.0
 */
ApiRange.prototype.SetAutoFilter = function (Field, Criteria1, Operator, Criteria2, VisibleDropDown) {};

/**
 * Sets an array formula to the current range.
 * @memberof ApiRange
 * @param {string | boolean | number} data - The general value for the cell or cell range.
 * @returns {boolean} - Returns false if such a range does not exist.
 * @since 9.0.0
 */
ApiRange.prototype.SetFormulaArray = function (data) { return true; };

/**
 * Returns an array formula from the current range.
 * @memberof ApiRange
 * @returns {string | null}
 * @since 9.0.0
 */
ApiRange.prototype.GetFormulaArray = function () { return ""; };

/**
 * Returns an array formula from the current range.
 * @memberof ApiRange
 * @returns {string | null}
 * @since 9.0.0
 */
ApiRange.prototype.FormulaArray = ApiRange.prototype.GetFormulaArray ();

/**
 * Returns a range that represents the expanded range around the current range.
 * @memberof ApiRange
 * @returns {ApiRange | null} - Returns the expanded range or null if the range cannot be expanded.
 * @since 9.1
 */
ApiRange.prototype.GetCurrentRegion = function () { return new ApiRange(); };

/**
 * Returns a range that represents the expanded range around the current range.
 * @memberof ApiRange
 * @returns {ApiRange | null} - Returns the expanded range or null if the range cannot be expanded.
 * @since 9.1
 */
ApiRange.prototype.CurrentRegion = ApiRange.prototype.GetCurrentRegion ();

/**
 * Returns a Range object that represents a range that's offset from this range.
 * @memberof ApiRange
 * @param {number} rowOffset - The number of rows to offset the range.
 * @param {number} columnOffset - The number of columns to offset the range.
 * @returns {ApiRange | null} - Returns the offset range or null if invalid.
 * @since 9.1.0
 */
ApiRange.prototype.Offset = function (rowOffset, columnOffset) { return new ApiRange(); };

/**
 * Resizes the range by changing the number of rows and columns.
 * @memberof ApiRange
 * @param {number} rowSize - The number of rows for the new range.
 * @param {number} columnSize - The number of columns for the new range.
 * @returns {ApiRange | null} - Returns the resized range or null if invalid.
 * @since 9.1.0
 */
ApiRange.prototype.Resize = function (rowSize, columnSize) { return new ApiRange(); };

/**
 * Returns a Range object that represents a cell or a range of cells.
 * When applied to a Range object, the property is relative to that Range object.
 * @memberof ApiRange
 * @param {string | ApiRange} cell1 - The first cell address (e.g., "A1" or "A1:B2").
 * @param {string | ApiRange} [cell2] - The second cell address (optional, defines corner with cell1).
 * @returns {ApiRange | null} - Returns the range relative to this range, or null if invalid.
 * @since 9.1.0
 */
ApiRange.prototype.GetRange = function (cell1, cell2) { return new ApiRange(); };

/**
 * Returns a Range object that represents the entire row(s) that contains the specified range.
 * @memberof ApiRange
 * @returns {ApiRange | null} - Returns the entire row range or null if invalid.
 * @since 9.1.0
 */
ApiRange.prototype.GetEntireRow = function () { return new ApiRange(); };

/**
 * Returns a Range object that represents the entire row(s) that contains the specified range.
 * @memberof ApiRange
 * @returns {ApiRange | null} - Returns the entire row range or null if invalid.
 * @since 9.1.0
 */
ApiRange.prototype.EntireRow = ApiRange.prototype.GetEntireRow ();

/**
 * Returns a Range object that represents the entire column(s) that contains the specified range.
 * @memberof ApiRange
 * @returns {ApiRange | null} - Returns the entire column range or null if invalid.
 * @since 9.1.0
 */
ApiRange.prototype.GetEntireColumn = function () { return new ApiRange(); };

/**
 * Returns a Range object that represents the entire column(s) that contains the specified range.
 * @memberof ApiRange
 * @returns {ApiRange | null} - Returns the entire column range or null if invalid.
 * @since 9.1.0
 */
ApiRange.prototype.EntireColumn = ApiRange.prototype.GetEntireColumn ();

/**
 * Returns a collection of the ranges.
 * @memberof ApiRange
 * @returns {ApiValidation}
 */
ApiRange.prototype.GetValidation = function () { return new ApiValidation(); };

/**
 * Returns a collection of the ranges.
 * @memberof ApiRange
 * @returns {ApiValidation}
 */
ApiRange.prototype.Validation = ApiRange.prototype.GetValidation ();

/**
 * Returns the format conditions collection for the range.
 * @memberof ApiRange
 * @returns {ApiFormatConditions}
 */
ApiRange.prototype.GetFormatConditions = function() { return new ApiFormatConditions(); };

/**
 * Returns the format conditions collection for the range.
 * @memberof ApiRange
 * @returns {ApiFormatConditions}
 */
ApiRange.prototype.FormatConditions = ApiRange.prototype.GetFormatConditions ();

/**
 * Returns a type of the ApiDrawing class.
 * @memberof ApiDrawing
 * @returns {"drawing"}
 */
ApiDrawing.prototype.GetClassType = function () { return ""; };

/**
 * Sets a size of the object (image, shape, chart) bounding box.
 * @memberof ApiDrawing
 * @param {EMU} nWidth - The object width measured in English measure units.
 * @param {EMU} nHeight - The object height measured in English measure units.
 */
ApiDrawing.prototype.SetSize = function (nWidth, nHeight) {};

/**
 * Changes the position for the drawing object.
 * <note>Please note that the horizontal and vertical offsets are calculated within the limits of
 * the specified column and row cells only. If this value exceeds the cell width or height, another vertical/horizontal position will be set.</note>
 * @memberof ApiDrawing
 * @param {number} nFromCol - The number of the column where the beginning of the drawing object will be placed.
 * @param {EMU} nColOffset - The offset from the nFromCol column to the left part of the drawing object measured in English measure units.
 * @param {number} nFromRow - The number of the row where the beginning of the drawing object will be placed.
 * @param {EMU} nRowOffset - The offset from the nFromRow row to the upper part of the drawing object measured in English measure units.
 */
ApiDrawing.prototype.SetPosition = function (nFromCol, nColOffset, nFromRow, nRowOffset) {};

/**
 * Returns the width of the current drawing.
 * @memberof ApiDrawing
 * @returns {EMU}
 */
ApiDrawing.prototype.GetWidth = function () { return new EMU(); };

/**
 * Returns the height of the current drawing.
 * @memberof ApiDrawing
 * @returns {EMU}
 */
ApiDrawing.prototype.GetHeight = function () { return new EMU(); };

/**
 * Returns the lock value for the specified lock type of the current drawing.
 * @param {DrawingLockType} sType - Lock type in the string format.
 * @returns {boolean}
 */
ApiDrawing.prototype.GetLockValue = function (sType) { return true; };

/**
 * Sets the lock value to the specified lock type of the current drawing.
 * @param {DrawingLockType} sType - Lock type in the string format.
 * @param {boolean} bValue - Specifies if the specified lock is applied to the current drawing.
 * @returns {boolean}
 */
ApiDrawing.prototype.SetLockValue = function (sType, bValue) { return true; };

/**
 * Returns the parent sheet of the current drawing.
 * @returns {ApiWorksheet}
 * @since 8.3.0
 */
ApiDrawing.prototype.GetParentSheet = function () { return new ApiWorksheet(); };

/**
 * Sets the rotation angle to the current drawing object.
 * @memberof ApiDrawing
 * @param {number} nRotAngle - New drawing rotation angle.
 * @returns {boolean}
 * @since 9.0.0
 */
ApiDrawing.prototype.SetRotation = function(nRotAngle){ return true; };

/**
 * Returns the rotation angle of the current drawing object.
 * @memberof ApiDrawing
 * @returns {number}
 * @since 9.0.0
 */
ApiDrawing.prototype.GetRotation = function(){ return 0; };

/**
 * Returns a type of the ApiImage class.
 * @memberof ApiImage
 * @returns {"image"}
 */
ApiImage.prototype.GetClassType = function () { return ""; };

/**
 * Returns a type of the ApiShape class.
 * @memberof ApiShape
 * @returns {"shape"}
 */
ApiShape.prototype.GetClassType = function () { return ""; };

/**
 * Returns the shape inner contents where a paragraph or text runs can be inserted.
 * @memberof ApiShape
 * @returns {ApiDocumentContent}
 */
ApiShape.prototype.GetContent = function () { return new ApiDocumentContent(); };

/**
 * Returns the shape inner contents where a paragraph or text runs can be inserted.
 * @memberof ApiShape
 * @returns {ApiDocumentContent}
 */
ApiShape.prototype.GetDocContent = function () { return new ApiDocumentContent(); };

/**
 * Sets the vertical alignment to the shape content where a paragraph or text runs can be inserted.
 * @memberof ApiShape
 * @param {"top" | "center" | "bottom" } sVerticalAlign - The vertical alignment type for the shape inner contents.
 * @returns {boolean} - returns false if shape or aligment doesn't exist.
 */
ApiShape.prototype.SetVerticalTextAlign = function (sVerticalAlign) { return true; };

/**
 * Gets the geometry object from a shape
 * @memberof ApiShape
 * @returns {ApiGeometry}
 * @since 9.1.0
 */
ApiShape.prototype.GetGeometry = function(){ return new ApiGeometry(); };

/**
 * Sets a custom geometry for the shape
 * @memberof ApiShape
 * @param {ApiGeometry} oGeometry - The geometry to set
 * @returns {boolean}
 * @since 9.1.0
 */
ApiShape.prototype.SetGeometry = function(oGeometry){ return true; };

/**
 * Sets values from the specified range to the specified series.
 * @memberof ApiChart
 * @param {string} sRange - A range of cells from the sheet with series values. For example:
 * "'sheet 1'!$A$2:$A$5" - must be a single cell, row or column,
 * "A1:A5" - must be a single cell, row or column,
 * "Example series".
 * @param {number} nSeria - The index of the chart series.
 * @returns {boolean}
 */
ApiChart.prototype.SetSeriaValues = function (sRange, nSeria) { return true; };

/**
 * Sets the x-axis values from the specified range to the specified series. It is used with the scatter charts only.
 * @memberof ApiChart
 * @param {string} sRange - A range of cells from the sheet with series x-axis values. For example:
 * "'sheet 1'!$A$2:$A$5" - must be a single cell, row or column,
 * "A1:A5" - must be a single cell, row or column,
 * "Example series".
 * @param {number} nSeria - The index of the chart series.
 * @returns {boolean}
 */
ApiChart.prototype.SetSeriaXValues = function (sRange, nSeria) { return true; };

/**
 * Sets a name to the specified series.
 * @memberof ApiChart
 * @param {string} sNameRange - The series name. Can be a range of cells or usual text. For example:
 * "'sheet 1'!$A$2:$A$5" - must be a single cell, row or column,
 * "A1:A5" - must be a single cell, row or column,
 * "Example series".
 * @param {number} nSeria - The index of the chart series.
 * @returns {boolean}
 */
ApiChart.prototype.SetSeriaName = function (sNameRange, nSeria) { return true; };

/**
 * Sets a range with the category values to the current chart.
 * @memberof ApiChart
 * @param {string} sRange - A range of cells from the sheet with the category names. For example:
 * "'sheet 1'!$A$2:$A$5" - must be a single cell, row or column,
 * "A1:A5" - must be a single cell, row or column.
 */
ApiChart.prototype.SetCatFormula = function (sRange) {};

/**
 * Adds a new series to the current chart.
 * @memberof ApiChart
 * @param {string} sNameRange - The series name. Can be a range of cells or usual text. For example:
 * "'sheet 1'!$A$2:$A$5" - must be a single cell, row or column,
 * "A1:A5" - must be a single cell, row or column,
 * "Example series".
 * @param {string} sValuesRange - A range of cells from the sheet with series values. For example:
 * "'sheet 1'!$A$2:$A$5" - must be a single cell, row or column,
 * "A1:A5" - must be a single cell, row or column.
 * @param {string} [sXValuesRange=undefined] - A range of cells from the sheet with series x-axis values. It is used with the scatter charts only. For example:
 * "'sheet 1'!$A$2:$A$5" - must be a single cell, row or column,
 * "A1:A5" - must be a single cell, row or column.
 */
ApiChart.prototype.AddSeria = function (sNameRange, sValuesRange, sXValuesRange) {};

/**
 * Returns a type of the ApiOleObject class.
 * @memberof ApiOleObject
 * @returns {"oleObject"}
 */
ApiOleObject.prototype.GetClassType = function () { return ""; };

/**
 * Sets the data to the current OLE object.
 * @memberof ApiOleObject
 * @param {string} sData - The OLE object string data.
 * @returns {boolean}
 */
ApiOleObject.prototype.SetData = function (sData) { return true; };

/**
 * Returns the string data from the current OLE object.
 * @memberof ApiOleObject
 * @returns {string}
 */
ApiOleObject.prototype.GetData = function () { return ""; };

/**
 * Sets the application ID to the current OLE object.
 * @memberof ApiOleObject
 * @param {string} sAppId - The application ID associated with the current OLE object.
 * @returns {boolean}
 */
ApiOleObject.prototype.SetApplicationId = function (sAppId) { return true; };

/**
 * Returns the application ID from the current OLE object.
 * @memberof ApiOleObject
 * @returns {string}
 */
ApiOleObject.prototype.GetApplicationId = function () { return ""; };

/**
 * Returns a type of the ApiColor class.
 * @memberof ApiColor
 * @returns {"color"}
 */
ApiColor.prototype.GetClassType = function () { return ""; };

/**
 * Returns a type of the ApiName class.
 * @memberof ApiName
 * @returns {string}
 */
ApiName.prototype.GetName = function () { return ""; };

/**
 * Sets a string value representing the object name.
 * @memberof ApiName
 * @param {string} sName - New name for the range.
 * @returns {boolean} - returns false if sName is invalid.
 */
ApiName.prototype.SetName = function (sName) { return true; };

/**
 * Sets a string value representing the object name.
 * @memberof ApiName
 * @param {string} sName - New name for the range.
 * @returns {boolean} - returns false if sName is invalid.
 */
ApiName.prototype.Name = ApiName.prototype.SetName ();

/**
 * Deletes the DefName object.
 * @memberof ApiName
 */
ApiName.prototype.Delete = function () {};

/**
 * Sets a formula that the name is defined to refer to.
 * @memberof ApiName
 * @param {string} sRef    - The range reference which must contain the sheet name, followed by sign ! and a range of cells.
 * Example: "Sheet1!$A$1:$B$2".
 */
ApiName.prototype.SetRefersTo = function (sRef) {};

/**
 * Returns a formula that the name is defined to refer to.
 * @memberof ApiName
 * @returns {string}
 */
ApiName.prototype.GetRefersTo = function () { return ""; };

/**
 * Returns a formula that the name is defined to refer to.
 * @memberof ApiName
 * @returns {string}
 */
ApiName.prototype.RefersTo = ApiName.prototype.GetRefersTo ();

/**
 * Returns the ApiRange object by its name.
 * @memberof ApiName
 * @returns {ApiRange}
 */
ApiName.prototype.GetRefersToRange = function () { return new ApiRange(); };

/**
 * Returns the ApiRange object by its name.
 * @memberof ApiName
 * @returns {ApiRange}
 */
ApiName.prototype.RefersToRange = ApiName.prototype.GetRefersToRange ();

/**
 * Returns a type of the ApiComment class.
 * @memberof ApiComment
 * @returns {"comment"}
 */
ApiComment.prototype.GetClassType = function () { return ""; };

/**
 * Returns the comment text.
 * @memberof ApiComment
 * @returns {string}
 */
ApiComment.prototype.GetText = function () { return ""; };

/**
 * Sets the comment text.
 * @memberof ApiComment
 * @param {string} text - New text for comment.
 * @since 7.5.0
 */
ApiComment.prototype.SetText = function (text) {};

/**
 * Sets the comment text.
 * @memberof ApiComment
 * @param {string} text - New text for comment.
 * @since 7.5.0
 */
ApiComment.prototype.Text = ApiComment.prototype.SetText ();

/**
 * Returns the current comment ID.
 * @memberof ApiComment
 * @returns {string}
 * @since 7.5.0
 */
ApiComment.prototype.GetId = function () { return ""; };

/**
 * Returns the current comment ID.
 * @memberof ApiComment
 * @returns {string}
 * @since 7.5.0
 */
ApiComment.prototype.Id = ApiComment.prototype.GetId ();

/**
 * Returns the comment author's name.
 * @memberof ApiComment
 * @returns {string}
 * @since 7.5.0
 */
ApiComment.prototype.GetAuthorName = function () { return ""; };

/**
 * Sets the comment author's name.
 * @memberof ApiComment
 * @param {string} sAuthorName - The comment author's name.
 * @since 7.5.0
 */
ApiComment.prototype.SetAuthorName = function (sAuthorName) {};

/**
 * Sets the comment author's name.
 * @memberof ApiComment
 * @param {string} sAuthorName - The comment author's name.
 * @since 7.5.0
 */
ApiComment.prototype.AuthorName = ApiComment.prototype.SetAuthorName ();

/**
 * Returns the user ID of the comment author.
 * @memberof ApiComment
 * @returns {string}
 * @since 7.5.0
 */
ApiComment.prototype.GetUserId = function () { return ""; };

/**
 * Sets the user ID to the comment author.
 * @memberof ApiComment
 * @param {string} sUserId - The user ID of the comment author.
 * @since 7.5.0
 */
ApiComment.prototype.SetUserId = function (sUserId) {};

/**
 * Sets the user ID to the comment author.
 * @memberof ApiComment
 * @param {string} sUserId - The user ID of the comment author.
 * @since 7.5.0
 */
ApiComment.prototype.UserId = ApiComment.prototype.SetUserId ();

/**
 * Checks if a comment is solved or not.
 * @memberof ApiComment
 * @returns {boolean}
 * @since 7.5.0
 */
ApiComment.prototype.IsSolved = function () { return true; };

/**
 * Marks a comment as solved.
 * @memberof ApiComment
 * @param {boolean} bSolved - Specifies if a comment is solved or not.
 * @since 7.5.0
 */
ApiComment.prototype.SetSolved = function (bSolved) {};

/**
 * Marks a comment as solved.
 * @memberof ApiComment
 * @param {boolean} bSolved - Specifies if a comment is solved or not.
 * @since 7.5.0
 */
ApiComment.prototype.Solved = ApiComment.prototype.SetSolved ();

/**
 * Returns the timestamp of the comment creation in UTC format.
 * @memberof ApiComment
 * @returns {Number}
 * @since 7.5.0
 */
ApiComment.prototype.GetTimeUTC = function () { return 0; };

/**
 * Sets the timestamp of the comment creation in UTC format.
 * @memberof ApiComment
 * @param {Number | String} nTimeStamp - The timestamp of the comment creation in UTC format.
 * @since 7.5.0
 */
ApiComment.prototype.SetTimeUTC = function (timeStamp) {};

/**
 * Sets the timestamp of the comment creation in UTC format.
 * @memberof ApiComment
 * @param {Number | String} nTimeStamp - The timestamp of the comment creation in UTC format.
 * @since 7.5.0
 */
ApiComment.prototype.TimeUTC = ApiComment.prototype.SetTimeUTC ();

/**
 * Returns the timestamp of the comment creation in the current time zone format.
 * @memberof ApiComment
 * @returns {Number}
 * @since 7.5.0
 */
ApiComment.prototype.GetTime = function () { return 0; };

/**
 * Sets the timestamp of the comment creation in the current time zone format.
 * @memberof ApiComment
 * @param {Number | String} nTimeStamp - The timestamp of the comment creation in the current time zone format.
 * @since 7.5.0
 */
ApiComment.prototype.SetTime = function (timeStamp) {};

/**
 * Sets the timestamp of the comment creation in the current time zone format.
 * @memberof ApiComment
 * @param {Number | String} nTimeStamp - The timestamp of the comment creation in the current time zone format.
 * @since 7.5.0
 */
ApiComment.prototype.Time = ApiComment.prototype.SetTime ();

/**
 * Returns the quote text of the current comment.
 * @memberof ApiComment
 * @returns {String | null}
 * @since 7.5.0
 */
ApiComment.prototype.GetQuoteText = function () { return ""; };

/**
 * Returns the quote text of the current comment.
 * @memberof ApiComment
 * @returns {String | null}
 * @since 7.5.0
 */
ApiComment.prototype.QuoteText = ApiComment.prototype.GetQuoteText ();

/**
 * Returns a number of the comment replies.
 * @memberof ApiComment
 * @returns {Number}
 * @since 7.5.0
 */
ApiComment.prototype.GetRepliesCount = function () { return 0; };

/**
 * Returns a number of the comment replies.
 * @memberof ApiComment
 * @returns {Number}
 * @since 7.5.0
 */
ApiComment.prototype.RepliesCount = ApiComment.prototype.GetRepliesCount ();

/**
 * Returns the specified comment reply.
 * @memberof ApiComment
 * @param {Number} [nIndex = 0] - The comment reply index.
 * @returns {ApiCommentReply}
 * @since 7.5.0
 */
ApiComment.prototype.GetReply = function (nIndex) { return new ApiCommentReply(); };

/**
 * Adds a reply to a comment.
 * @memberof ApiComment
 * @param {String} sText - The comment reply text (required).
 * @param {String} sAuthorName - The name of the comment reply author (optional).
 * @param {String} sUserId - The user ID of the comment reply author (optional).
 * @param {Number} [nPos=this.GetRepliesCount()] - The comment reply position.
 * @since 7.5.0
 */
ApiComment.prototype.AddReply = function (sText, sAuthorName, sUserId, nPos) {};

/**
 * Removes the specified comment replies.
 * @memberof ApiComment
 * @param {Number} [nPos = 0] - The position of the first comment reply to remove.
 * @param {Number} [nCount = 1] - A number of comment replies to remove.
 * @param {boolean} [bRemoveAll = false] - Specifies whether to remove all comment replies or not.
 * @since 7.5.0
 */
ApiComment.prototype.RemoveReplies = function (nPos, nCount, bRemoveAll) {};

/**
 * Deletes the ApiComment object.
 * @memberof ApiComment
 */
ApiComment.prototype.Delete = function () {};

/**
 * Returns a type of the ApiCommentReply class.
 * @memberof ApiCommentReply
 * @returns {"commentReply"}
 * @since 7.5.0
 */
ApiCommentReply.prototype.GetClassType = function () { return ""; };

/**
 * Returns the comment reply text.
 * @memberof ApiCommentReply
 * @returns {string}
 * @since 7.5.0
 */
ApiCommentReply.prototype.GetText = function () { return ""; };

/**
 * Sets the comment reply text.
 * @memberof ApiCommentReply
 * @param {string} sText - The comment reply text.
 * @since 7.5.0
 */
ApiCommentReply.prototype.SetText = function (sText) {};

/**
 * Sets the comment reply text.
 * @memberof ApiCommentReply
 * @param {string} sText - The comment reply text.
 * @since 7.5.0
 */
ApiCommentReply.prototype.Text = ApiCommentReply.prototype.SetText ();

/**
 * Returns the comment reply author's name.
 * @memberof ApiCommentReply
 * @returns {string}
 * @since 7.5.0
 */
ApiCommentReply.prototype.GetAuthorName = function () { return ""; };

/**
 * Sets the comment reply author's name.
 * @memberof ApiCommentReply
 * @param {string} sAuthorName - The comment reply author's name.
 * @since 7.5.0
 */
ApiCommentReply.prototype.SetAuthorName = function (sAuthorName) {};

/**
 * Sets the comment reply author's name.
 * @memberof ApiCommentReply
 * @param {string} sAuthorName - The comment reply author's name.
 * @since 7.5.0
 */
ApiCommentReply.prototype.AuthorName = ApiCommentReply.prototype.SetAuthorName ();

/**
 * Returns the user ID of the comment reply author.
 * @memberof ApiCommentReply
 * @returns {string}
 * @since 7.5.0
 */
ApiCommentReply.prototype.GetUserId = function () { return ""; };

/**
 * Sets the user ID to the comment reply author.
 * @memberof ApiCommentReply
 * @param {string} sUserId - The user ID of the comment reply author.
 * @since 7.5.0
 */
ApiCommentReply.prototype.SetUserId = function (sUserId) {};

/**
 * Sets the user ID to the comment reply author.
 * @memberof ApiCommentReply
 * @param {string} sUserId - The user ID of the comment reply author.
 * @since 7.5.0
 */
ApiCommentReply.prototype.UserId = ApiCommentReply.prototype.SetUserId ();

/**
 * Returns the timestamp of the comment reply creation in UTC format.
 * @memberof ApiCommentReply
 * @returns {Number}
 * @since 7.5.0
 */
ApiCommentReply.prototype.GetTimeUTC = function () { return 0; };

/**
 * Sets the timestamp of the comment reply creation in UTC format.
 * @memberof ApiCommentReply
 * @param {Number | String} nTimeStamp - The timestamp of the comment reply creation in UTC format.
 * @since 7.5.0
 */
ApiCommentReply.prototype.SetTimeUTC = function (timeStamp) {};

/**
 * Sets the timestamp of the comment reply creation in UTC format.
 * @memberof ApiCommentReply
 * @param {Number | String} nTimeStamp - The timestamp of the comment reply creation in UTC format.
 * @since 7.5.0
 */
ApiCommentReply.prototype.TimeUTC = ApiCommentReply.prototype.SetTimeUTC ();

/**
 * Returns the timestamp of the comment reply creation in the current time zone format.
 * @memberof ApiCommentReply
 * @returns {Number}
 * @since 7.5.0
 */
ApiCommentReply.prototype.GetTime = function () { return 0; };

/**
 * Sets the timestamp of the comment reply creation in the current time zone format.
 * @memberof ApiCommentReply
 * @param {Number | String} nTimeStamp - The timestamp of the comment reply creation in the current time zone format.
 * @since 7.5.0
 */
ApiCommentReply.prototype.SetTime = function (timeStamp) {};

/**
 * Sets the timestamp of the comment reply creation in the current time zone format.
 * @memberof ApiCommentReply
 * @param {Number | String} nTimeStamp - The timestamp of the comment reply creation in the current time zone format.
 * @since 7.5.0
 */
ApiCommentReply.prototype.Time = ApiCommentReply.prototype.SetTime ();

/**
 * Returns a value that represents the number of objects in the collection.
 * @memberof ApiAreas
 * @returns {number}
 */
ApiAreas.prototype.GetCount = function () { return 0; };

/**
 * Returns a value that represents the number of objects in the collection.
 * @memberof ApiAreas
 * @returns {number}
 */
ApiAreas.prototype.Count = ApiAreas.prototype.GetCount ();

/**
 * Returns a single object from a collection by its ID.
 * @memberof ApiAreas
 * @param {number} ind - The index number of the object.
 * @returns {ApiRange}
 */
ApiAreas.prototype.GetItem = function (ind) { return new ApiRange(); };

/**
 * Returns the parent object for the specified collection.
 * @memberof ApiAreas
 * @returns {number}
 */
ApiAreas.prototype.GetParent = function () { return 0; };

/**
 * Returns the parent object for the specified collection.
 * @memberof ApiAreas
 * @returns {number}
 */
ApiAreas.prototype.Parent = ApiAreas.prototype.GetParent ();

/**
 * Returns a value that represents a number of objects in the collection.
 * @memberof ApiCharacters
 * @returns {number}
 * @since 7.4.0
 */
ApiCharacters.prototype.GetCount = function () { return 0; };

/**
 * Returns a value that represents a number of objects in the collection.
 * @memberof ApiCharacters
 * @returns {number}
 * @since 7.4.0
 */
ApiCharacters.prototype.Count = ApiCharacters.prototype.GetCount ();

/**
 * Returns the parent object of the specified characters.
 * @memberof ApiCharacters
 * @returns {ApiRange}
 * @since 7.4.0
 */
ApiCharacters.prototype.GetParent = function () { return new ApiRange(); };

/**
 * Returns the parent object of the specified characters.
 * @memberof ApiCharacters
 * @returns {ApiRange}
 * @since 7.4.0
 */
ApiCharacters.prototype.Parent = ApiCharacters.prototype.GetParent ();

/**
 * Deletes the ApiCharacters object.
 * @memberof ApiCharacters
 * @since 7.4.0
 */
ApiCharacters.prototype.Delete = function () {};

/**
 * Inserts a string replacing the specified characters.
 * @memberof ApiCharacters
 * @param {string} String - The string to insert.
 * @since 7.4.0
 */
ApiCharacters.prototype.Insert = function (String) {};

/**
 * Sets a string value that represents the text of the specified range of characters.
 * @memberof ApiCharacters
 * @param {string} Caption - A string value that represents the text of the specified range of characters.
 * @since 7.4.0
 */
ApiCharacters.prototype.SetCaption = function (Caption) {};

/**
 * Returns a string value that represents the text of the specified range of characters.
 * @memberof ApiCharacters
 * @returns {string} - A string value that represents the text of the specified range of characters.
 * @since 7.4.0
 */
ApiCharacters.prototype.GetCaption = function () { return ""; };

/**
 * Returns a string value that represents the text of the specified range of characters.
 * @memberof ApiCharacters
 * @returns {string} - A string value that represents the text of the specified range of characters.
 * @since 7.4.0
 */
ApiCharacters.prototype.Caption = ApiCharacters.prototype.GetCaption ();

/**
 * Sets the text for the specified characters.
 * @memberof ApiCharacters
 * @param {string} Text - The text to be set.
 * @since 7.4.0
 */
ApiCharacters.prototype.SetText = function (Text) {};

/**
 * Returns the text of the specified range of characters.
 * @memberof ApiCharacters
 * @returns {string} - The text of the specified range of characters.
 * @since 7.4.0
 */
ApiCharacters.prototype.GetText = function () { return ""; };

/**
 * Returns the text of the specified range of characters.
 * @memberof ApiCharacters
 * @returns {string} - The text of the specified range of characters.
 * @since 7.4.0
 */
ApiCharacters.prototype.Text = ApiCharacters.prototype.GetText ();

/**
 * Returns the ApiFont object that represents the font of the specified characters.
 * @memberof ApiCharacters
 * @returns {ApiFont}
 * @since 7.4.0
 */
ApiCharacters.prototype.GetFont = function () { return new ApiFont(); };

/**
 * Returns the ApiFont object that represents the font of the specified characters.
 * @memberof ApiCharacters
 * @returns {ApiFont}
 * @since 7.4.0
 */
ApiCharacters.prototype.Font = ApiCharacters.prototype.GetFont ();

/**
 * Returns a type of the ApiTheme class.
 *
 * @memberof ApiTheme
 * @returns {"theme"}
 * @since 9.1.0
 */
ApiTheme.prototype.GetClassType = function () { return ""; };

/**
 * Returns the name of the theme.
 *
 * @memberof ApiTheme
 * @returns {string} - The name of the theme.
 * @since 9.1.0
 */
ApiTheme.prototype.GetName = function () { return ""; };

/**
 * Returns the parent ApiCharacters object of the specified font.
 * @memberof ApiFont
 * @returns {ApiCharacters} - The parent ApiCharacters object.
 * @since 7.4.0
 */
ApiFont.prototype.GetParent = function () { return new ApiCharacters(); };

/**
 * Returns the parent ApiCharacters object of the specified font.
 * @memberof ApiFont
 * @returns {ApiCharacters} - The parent ApiCharacters object.
 * @since 7.4.0
 */
ApiFont.prototype.Parent = ApiFont.prototype.GetParent ();

/**
 * Returns the bold property of the specified font.
 * @memberof ApiFont
 * @returns {boolean | null}
 * @since 7.4.0
 */
ApiFont.prototype.GetBold = function () { return true; };

/**
 * Sets the bold property to the specified font.
 * <note>This method will work only with the text format of the cell.</note>
 * @memberof ApiFont
 * @param {boolean} isBold - Specifies that the text characters are displayed bold.
 * @since 7.4.0
 */
ApiFont.prototype.SetBold = function (isBold) {};

/**
 * Sets the bold property to the specified font.
 * <note>This method will work only with the text format of the cell.</note>
 * @memberof ApiFont
 * @param {boolean} isBold - Specifies that the text characters are displayed bold.
 * @since 7.4.0
 */
ApiFont.prototype.Bold = ApiFont.prototype.SetBold ();

/**
 * Returns the italic property of the specified font.
 * @memberof ApiFont
 * @returns {boolean | null}
 * @since 7.4.0
 */
ApiFont.prototype.GetItalic = function () { return true; };

/**
 * Sets the italic property to the specified font.
 * <note>This method will work only with the text format of the cell.</note>
 * @memberof ApiFont
 * @param {boolean} isItalic - Specifies that the text characters are displayed italic.
 * @since 7.4.0
 */
ApiFont.prototype.SetItalic = function (isItalic) {};

/**
 * Sets the italic property to the specified font.
 * <note>This method will work only with the text format of the cell.</note>
 * @memberof ApiFont
 * @param {boolean} isItalic - Specifies that the text characters are displayed italic.
 * @since 7.4.0
 */
ApiFont.prototype.Italic = ApiFont.prototype.SetItalic ();

/**
 * Returns the font size property of the specified font.
 * @memberof ApiFont
 * @returns {number | null}
 * @since 7.4.0
 */
ApiFont.prototype.GetSize = function () { return 0; };

/**
 * Sets the font size property to the specified font.
 * <note>This method will work only with the text format of the cell.</note>
 * @memberof ApiFont
 * @param {number} Size - Font size.
 * @since 7.4.0
 */
ApiFont.prototype.SetSize = function (Size) {};

/**
 * Sets the font size property to the specified font.
 * <note>This method will work only with the text format of the cell.</note>
 * @memberof ApiFont
 * @param {number} Size - Font size.
 * @since 7.4.0
 */
ApiFont.prototype.Size = ApiFont.prototype.SetSize ();

/**
 * Returns the strikethrough property of the specified font.
 * @memberof ApiFont
 * @returns {boolean | null}
 * @since 7.4.0
 */
ApiFont.prototype.GetStrikethrough = function () { return true; };

/**
 * Sets the strikethrough property to the specified font.
 * <note>This method will work only with the text format of the cell.</note>
 * @memberof ApiFont
 * @param {boolean} isStrikethrough - Specifies that the text characters are displayed strikethrough.
 * @since 7.4.0
 */
ApiFont.prototype.SetStrikethrough = function (isStrikethrough) {};

/**
 * Sets the strikethrough property to the specified font.
 * <note>This method will work only with the text format of the cell.</note>
 * @memberof ApiFont
 * @param {boolean} isStrikethrough - Specifies that the text characters are displayed strikethrough.
 * @since 7.4.0
 */
ApiFont.prototype.Strikethrough = ApiFont.prototype.SetStrikethrough ();

/**
 * Underline type.
 * @typedef {("xlUnderlineStyleDouble" | "xlUnderlineStyleDoubleAccounting" | "xlUnderlineStyleNone" | "xlUnderlineStyleSingle" | "xlUnderlineStyleSingleAccounting")} XlUnderlineStyle
 */

/**
 * Returns the type of underline applied to the specified font.
 * @memberof ApiFont
 * @returns {XlUnderlineStyle | null}
 * @since 7.4.0
 */
ApiFont.prototype.GetUnderline = function () { return new XlUnderlineStyle(); };

/**
 * Sets an underline of the type specified in the request to the current font.
 * <note>This method will work only with the text format of the cell.</note>
 * @memberof ApiFont
 * @param {XlUnderlineStyle} Underline - Underline type.
 * @since 7.4.0
 */
ApiFont.prototype.SetUnderline = function (Underline) {};

/**
 * Sets an underline of the type specified in the request to the current font.
 * <note>This method will work only with the text format of the cell.</note>
 * @memberof ApiFont
 * @param {XlUnderlineStyle} Underline - Underline type.
 * @since 7.4.0
 */
ApiFont.prototype.Underline = ApiFont.prototype.SetUnderline ();

/**
 * Returns the subscript property of the specified font.
 * @memberof ApiFont
 * @returns {boolean | null}
 * @since 7.4.0
 */
ApiFont.prototype.GetSubscript = function () { return true; };

/**
 * Sets the subscript property to the specified font.
 * <note>This method will work only with the text format of the cell.</note>
 * @memberof ApiFont
 * @param {boolean} isSubscript - Specifies that the text characters are displayed subscript.
 * @since 7.4.0
 */
ApiFont.prototype.SetSubscript = function (isSubscript) {};

/**
 * Sets the subscript property to the specified font.
 * <note>This method will work only with the text format of the cell.</note>
 * @memberof ApiFont
 * @param {boolean} isSubscript - Specifies that the text characters are displayed subscript.
 * @since 7.4.0
 */
ApiFont.prototype.Subscript = ApiFont.prototype.SetSubscript ();

/**
 * Returns the superscript property of the specified font.
 * @memberof ApiFont
 * @returns {boolean | null}
 * @since 7.4.0
 */
ApiFont.prototype.GetSuperscript = function () { return true; };

/**
 * Sets the superscript property to the specified font.
 * <note>This method will work only with the text format of the cell.</note>
 * @memberof ApiFont
 * @param {boolean} isSuperscript - Specifies that the text characters are displayed superscript.
 * @since 7.4.0
 */
ApiFont.prototype.SetSuperscript = function (isSuperscript) {};

/**
 * Sets the superscript property to the specified font.
 * <note>This method will work only with the text format of the cell.</note>
 * @memberof ApiFont
 * @param {boolean} isSuperscript - Specifies that the text characters are displayed superscript.
 * @since 7.4.0
 */
ApiFont.prototype.Superscript = ApiFont.prototype.SetSuperscript ();

/**
 * Returns the font name property of the specified font.
 * @memberof ApiFont
 * @returns {string | null}
 * @since 7.4.0
 */
ApiFont.prototype.GetName = function () { return ""; };

/**
 * Sets the font name property to the specified font.
 * <note>This method will work only with the text format of the cell.</note>
 * @memberof ApiFont
 * @param {string} FontName - Font name.
 * @since 7.4.0
 */
ApiFont.prototype.SetName = function (FontName) {};

/**
 * Sets the font name property to the specified font.
 * <note>This method will work only with the text format of the cell.</note>
 * @memberof ApiFont
 * @param {string} FontName - Font name.
 * @since 7.4.0
 */
ApiFont.prototype.Name = ApiFont.prototype.SetName ();

/**
 * Returns the font color property of the specified font.
 * @memberof ApiFont
 * @returns {ApiColor | null}
 * @since 7.4.0
 */
ApiFont.prototype.GetColor = function () { return new ApiColor(); };

/**
 * Sets the font color property to the specified font.
 * <note>This method will work only with the text format of the cell.</note>
 * @memberof ApiFont
 * @param {ApiColor} Color - Font color.
 * @since 7.4.0
 */
ApiFont.prototype.SetColor = function (Color) {};

/**
 * Sets the font color property to the specified font.
 * <note>This method will work only with the text format of the cell.</note>
 * @memberof ApiFont
 * @param {ApiColor} Color - Font color.
 * @since 7.4.0
 */
ApiFont.prototype.Color = ApiFont.prototype.SetColor ();

/**
 * Sets the frozen cells in the active worksheet view. The range provided corresponds to the cells that will be frozen in the top- and left-most pane.
 * @memberof ApiFreezePanes
 * @param {ApiRange | String} frozenRange - A range that represents the cells to be frozen.
 * @since 8.0.0
 */
ApiFreezePanes.prototype.FreezeAt = function (frozenRange) {};

/**
 * Freezes the first column or columns of the current worksheet.
 * @memberof ApiFreezePanes
 * @param {Number} [count=0] - Optional number of columns to freeze, or zero to unfreeze all columns.
 * @since 8.0.0
 */
ApiFreezePanes.prototype.FreezeColumns = function (count) {};

/**
 * Freezes the top row or rows of the current worksheet.
 * @memberof ApiFreezePanes
 * @param {Number} [count=0] - Optional number of rows to freeze, or zero to unfreeze all rows.
 * @since 8.0.0
 */
ApiFreezePanes.prototype.FreezeRows = function (count) {};

/**
 * Returns a range that describes the frozen cells in the active worksheet view.
 * @memberof ApiFreezePanes
 * @returns {ApiRange | null} - Returns null if there is no frozen pane.
 * @since 8.0.0
 */
ApiFreezePanes.prototype.GetLocation = function () { return new ApiRange(); };

/**
 * Removes all frozen panes in the current worksheet.
 * @memberof ApiFreezePanes
 * @since 8.0.0
 */
ApiFreezePanes.prototype.Unfreeze = function () {};

/**
 * Class representing a user-protected range.
 * @constructor
 */
function ApiProtectedRange(protectedRange) {}

/**
 * Sets a title to the current protected range.
 * @memberof ApiProtectedRange
 * @param {string} sTitle - The title which will be displayed for the current protected range.
 * @returns {boolean} - Returns false if a user doesn't have permission to modify the protected range.
 * @since 8.1.0
 */
ApiProtectedRange.prototype.SetTitle = function (sTitle) { return true; };

/**
 * Sets a range to the current protected range.
 * @memberof ApiProtectedRange
 * @param {string} sRange - The cell range which will be set for the current protected range.
 * @returns {boolean} - Returns false if a user doesn't have permission to modify the protected range.
 * @since 8.1.0
 */
ApiProtectedRange.prototype.SetRange = function (sRange) { return true; };

/**
 * Specifies the user type of the protected range.
 * @typedef {("CanEdit" | "CanView" | "NotView")} ProtectedRangeUserType
 */

/**
 * Sets a user to the current protected range.
 * @memberof ApiProtectedRange
 * @param {string} sId - The user ID.
 * @param {string} sName - The user name.
 * @param {ProtectedRangeUserType} protectedRangeUserType - The user type of the protected range.
 * @returns {ApiProtectedRangeUserInfo | null} - Returns null if a user doesn't have permission to modify the protected range.
 * @since 8.1.0
 */
ApiProtectedRange.prototype.AddUser = function (sId, sName, protectedRangeUserType) { return new ApiProtectedRangeUserInfo(); };

/**
 * Removes a user from the current protected range.
 * @memberof ApiProtectedRange
 * @param {string} sId - The user ID.
 * @returns {boolean}
 * @since 8.1.0
 */
ApiProtectedRange.prototype.DeleteUser = function (sId) { return true; };

/**
 * Returns all users from the current protected range.
 * @memberof ApiProtectedRange
 * @returns {ApiProtectedRangeUserInfo[] | null}
 * @since 8.1.0
 */
ApiProtectedRange.prototype.GetAllUsers = function () { return [new ApiProtectedRangeUserInfo()]; };

/**
 * Sets the type of the "Anyone" user to the current protected range.
 * @memberof ApiProtectedRange
 * @param {ProtectedRangeUserType} protectedRangeUserType - The user type of the protected range.
 * @returns {boolean}
 * @since 8.1.0
 */
ApiProtectedRange.prototype.SetAnyoneType = function (protectedRangeUserType) { return true; };

/**
 * Returns an object that represents a user from the current protected range.
 * @memberof ApiProtectedRange
 * @param {string} sId - The user ID.
 * @returns {ApiProtectedRangeUserInfo | null}
 * @since 8.1.0
 */
ApiProtectedRange.prototype.GetUser = function (sId) { return new ApiProtectedRangeUserInfo(); };

/**
 * Class representing a user from the current protected range.
 * @constructor
 */
function ApiProtectedRangeUserInfo(userInfo, protectedRange) {}

/**
 * Returns the name property of the current user's information.
 * @memberof ApiProtectedRangeUserInfo
 * @returns {string | null}
 * @since 8.1.0
 */
ApiProtectedRangeUserInfo.prototype.GetName = function () { return ""; };

/**
 * Returns the type property of the current user's information.
 * @memberof ApiProtectedRangeUserInfo
 * @returns {ProtectedRangeUserType}
 * @since 8.1.0
 */
ApiProtectedRangeUserInfo.prototype.GetType = function () { return new ProtectedRangeUserType(); };

/**
 * Returns the ID property of the current user's information.
 * @memberof ApiProtectedRangeUserInfo
 * @returns {string | null}
 * @since 8.1.0
 */
ApiProtectedRangeUserInfo.prototype.GetId = function () { return ""; };

/**
 * Adds a data field to the pivot table report.
 * @memberof ApiPivotTable
 * @param {number | string} field - The index number or name of the data field.
 * @returns {ApiPivotDataField}
 * @since 8.2.0
 */
ApiPivotTable.prototype.AddDataField = function (field) { return new ApiPivotDataField(); };

/**
 * Adds the row, column, and page fields to the pivot table report.
 * @memberof ApiPivotTable
 * @param {PivotTableFieldOptions} options - The settings for adding row, column, and page fields to the pivot table report.
 * @since 8.2.0
 */
ApiPivotTable.prototype.AddFields = function (options) {};

/**
 * Deletes all filters currently applied to the pivot table.
 * @memberof ApiPivotTable
 * @since 8.2.0
 */
ApiPivotTable.prototype.ClearAllFilters = function () {};

/**
 * Clears the pivot table.
 * @memberof ApiPivotTable
 * @since 8.2.0
 */
ApiPivotTable.prototype.ClearTable = function () {};

/**
 * Returns the value for the data field in a pivot table.
 * @memberof ApiPivotTable
 * @param {string[]} items - Describes a single cell in the pivot table report.
 * For example, "'Estimated Costs' Tables May", which shows the estimated costs for tables in May
 * (Data field = Costs, Product = Tables, Month = May).
 * @returns {number | null}
 * @since 8.2.0
 */
ApiPivotTable.prototype.GetData = function (items) { return 0; };

/**
 * Returns a Range object with information about a data item in the pivot table report.
 * @memberof ApiPivotTable
 * @param {string} [dataField] - The name of the field containing the data for the PivotTable.
 * @param {string[]} [fieldItemsArray] - An array of field items from the pivot table.
 * @returns {ApiRange}
 * @since 8.2.0
 */
ApiPivotTable.prototype.GetPivotData = function (dataField, fieldItemsArray) { return new ApiRange(); };

/**
 * Returns a collection that represents either a single pivot table field
 * or a collection of both the visible and hidden fields in the pivot table report.
 * @memberof ApiPivotTable
 * @param {string | number} [field] - The name or index of the field to be returned.
 * @returns {ApiPivotField[] | ApiPivotField | ApiPivotDataField | null}
 * @since 8.2.0
 */
ApiPivotTable.prototype.GetPivotFields = function (field) { return [new ApiPivotField()]; };

/**
 * Returns a collection that represents either a single pivot table field
 * or a collection of both the visible and hidden fields in the pivot table report.
 * @memberof ApiPivotTable
 * @param {string | number} [field] - The name or index of the field to be returned.
 * @returns {ApiPivotField[] | ApiPivotField | ApiPivotDataField | null}
 * @since 8.2.0
 */
ApiPivotTable.prototype.PivotFields = ApiPivotTable.prototype.GetPivotFields ();

/**
 * Returns the value of a pivot table cell.
 * @memberof ApiPivotTable
 * @param {number} rowLine - The position of the pivot line (a line of rows in the pivot table) on the row area.
 * @param {number} colLine - The position of the pivot line (a line of columns in the pivot table) on the column area.
 * @returns {number | string | null}
 * @since 8.2.0
 */
ApiPivotTable.prototype.PivotValueCell = function (rowLine, colLine) { return 0; };

/**
 * Shows details of the pivot table cell.
 * @memberof ApiPivotTable
 * @param {number} rowLine - The position of the pivot line (a line of rows in the pivot table) on the row area.
 * @param {number} colLine - The position of the pivot line (a line of columns in the pivot table) on the column area.
 * @returns {boolean} - Returns true if the operation is successful.
 * @since 8.2.0
 */
ApiPivotTable.prototype.ShowDetails = function (rowLine, colLine) { return true; };

/**
 * Refreshes the pivot table report from the source data.
 * @memberof ApiPivotTable
 * @since 8.2.0
 */
ApiPivotTable.prototype.RefreshTable = function () {};

/**
 * Updates the current pivot table.
 * @memberof ApiPivotTable
 * @since 8.2.0
 */
ApiPivotTable.prototype.Update = function () {};

/**
 * Specifies whether to repeat item labels for all pivot fields in the specified pivot table.
 * @memberof ApiPivotTable
 * @param {boolean} repeat - Specifies whether to repeat all field item labels in a pivot table report.
 * @since 8.2.0
 */
ApiPivotTable.prototype.SetRepeatAllLabels = function (repeat) {};

/**
 * Specifies whether to repeat item labels for all pivot fields in the specified pivot table.
 * @memberof ApiPivotTable
 * @param {boolean} repeat - Specifies whether to repeat all field item labels in a pivot table report.
 * @since 8.2.0
 */
ApiPivotTable.prototype.RepeatAllLabels = ApiPivotTable.prototype.SetRepeatAllLabels ();

/**
 * Sets the way the specified pivot table items appear — in table format or in outline format.
 * @memberof ApiPivotTable
 * @param {PivotLayoutType} type - The layout type of the pivot table report.
 * @param {boolean} compact - Specifies whether the pivot table items will be displayed in the compact form.
 * @since 8.2.0
 */
ApiPivotTable.prototype.SetRowAxisLayout = function (type, compact) {};

/**
 * Sets the way the specified pivot table items appear — in table format or in outline format.
 * @memberof ApiPivotTable
 * @param {PivotLayoutType} type - The layout type of the pivot table report.
 * @param {boolean} compact - Specifies whether the pivot table items will be displayed in the compact form.
 * @since 8.2.0
 */
ApiPivotTable.prototype.RowAxisLayout = ApiPivotTable.prototype.SetRowAxisLayout ();

/**
 * The type of the pivot table subtotal layout.
 * @typedef { "Hidden" | "Top" | "Bottom" } PivotSubtotalLayoutType
 */

/**
 * Sets the layout subtotal location in the pivot table.
 * @memberof ApiPivotTable
 * @param {PivotSubtotalLayoutType} type - The type of the pivot table subtotal layout.
 * @since 8.2.0
 */
ApiPivotTable.prototype.SetSubtotalLocation = function (type) {};

/**
 * Sets the layout subtotal location in the pivot table.
 * @memberof ApiPivotTable
 * @param {PivotSubtotalLayoutType} type - The type of the pivot table subtotal layout.
 * @since 8.2.0
 */
ApiPivotTable.prototype.SubtotalLocation = ApiPivotTable.prototype.SetSubtotalLocation ();

/**
 * Removes the specified field from all the pivot table categories.
 * @memberof ApiPivotTable
 * @param {number | string} identifier - The index number or name of the field.
 * @since 8.2.0
 */
ApiPivotTable.prototype.RemoveField = function (identifier) {};

/**
 * The direction to move the pivot table field.
 * @typedef { "Up" | "Down" | "Begin" | "End" } PivotMoveFieldType
 */

/**
 * The pivot field orientation type.
 * @typedef {"Rows" | "Columns" | "Filters" | "Values" | "Hidden" } PivotFieldOrientationType
 */

/**
 * Moves the specified field from one category to another.
 * @memberof ApiPivotTable
 * @param {number | string} identifier - The index number or name of the field.
 * @param {PivotMoveFieldType | PivotFieldOrientationType} type - The direction to move the pivot table field,
 * or the pivot field orientation type.
 * @param {number} [index] - The field index in a new category.
 * @since 8.2.0
 */
ApiPivotTable.prototype.MoveField = function (identifier, type, index) {};

/**
 * Selects the current pivot table.
 * @memberof ApiPivotTable
 * @since 8.2.0
 */
ApiPivotTable.prototype.Select = function () {};

/**
 * Returns a collection that is currently displayed as column fields in the pivot table.
 * @memberof ApiPivotTable
 * @param {number | string | undefined} field - The name or index of the field to be returned.
 * @returns {ApiPivotField[]}
 * @since 8.2.0
 */
ApiPivotTable.prototype.GetColumnFields = function (field) { return [new ApiPivotField()]; };

/**
 * Returns a collection that is currently displayed as column fields in the pivot table.
 * @memberof ApiPivotTable
 * @param {number | string | undefined} field - The name or index of the field to be returned.
 * @returns {ApiPivotField[]}
 * @since 8.2.0
 */
ApiPivotTable.prototype.ColumnFields = ApiPivotTable.prototype.GetColumnFields ();

/**
 * Returns a collection that represents either a single pivot table data field
 * or a collection of all visible data fields.
 * @memberof ApiPivotTable
 * @param {number | string |undefined} field - The name or index of the field to be returned.
 * @returns {ApiPivotDataField[] | ApiPivotDataField | null}
 * @since 8.2.0
 */
ApiPivotTable.prototype.GetDataFields = function (field) { return [new ApiPivotDataField()]; };

/**
 * Returns a collection that represents either a single pivot table data field
 * or a collection of all visible data fields.
 * @memberof ApiPivotTable
 * @param {number | string |undefined} field - The name or index of the field to be returned.
 * @returns {ApiPivotDataField[] | ApiPivotDataField | null}
 * @since 8.2.0
 */
ApiPivotTable.prototype.DataFields = ApiPivotTable.prototype.GetDataFields ();

/**
 * Returns an array that represents all the hidden fields in the pivot table.
 * @memberof ApiPivotTable
 * @returns {ApiPivotField[]}
 * @since 8.2.0
 */
ApiPivotTable.prototype.GetHiddenFields = function () { return [new ApiPivotField()]; };

/**
 * Returns an array that represents all the hidden fields in the pivot table.
 * @memberof ApiPivotTable
 * @returns {ApiPivotField[]}
 * @since 8.2.0
 */
ApiPivotTable.prototype.HiddenFields = ApiPivotTable.prototype.GetHiddenFields ();

/**
 * Returns an array that represents all the visible fields in the pivot table.
 * @memberof ApiPivotTable
 * @returns {ApiPivotField[]}
 * @since 8.2.0
 */
ApiPivotTable.prototype.GetVisibleFields = function () { return [new ApiPivotField()]; };

/**
 * Returns an array that represents all the visible fields in the pivot table.
 * @memberof ApiPivotTable
 * @returns {ApiPivotField[]}
 * @since 8.2.0
 */
ApiPivotTable.prototype.VisibleFields = ApiPivotTable.prototype.GetVisibleFields ();

/**
 * Returns a collection that represents either a single pivot table page field
 * or a collection of all visible page fields.
 * @memberof ApiPivotTable
 * @param {number | string |undefined} field - The name or index of the field to be returned.
 * @returns {ApiPivotField[]}
 * @since 8.2.0
 */
ApiPivotTable.prototype.GetPageFields = function (field) { return [new ApiPivotField()]; };

/**
 * Returns a collection that represents either a single pivot table page field
 * or a collection of all visible page fields.
 * @memberof ApiPivotTable
 * @param {number | string |undefined} field - The name or index of the field to be returned.
 * @returns {ApiPivotField[]}
 * @since 8.2.0
 */
ApiPivotTable.prototype.PageFields = ApiPivotTable.prototype.GetPageFields ();

/**
 * Returns a collection that is currently displayed as row fields in the pivot table.
 * @memberof ApiPivotTable
 * @param {number | string |undefined} field - The name or index of the field to be returned.
 * @returns {ApiPivotField[]}
 * @since 8.2.0
 */
ApiPivotTable.prototype.GetRowFields = function (field) { return [new ApiPivotField()]; };

/**
 * Returns a collection that is currently displayed as row fields in the pivot table.
 * @memberof ApiPivotTable
 * @param {number | string |undefined} field - The name or index of the field to be returned.
 * @returns {ApiPivotField[]}
 * @since 8.2.0
 */
ApiPivotTable.prototype.RowFields = ApiPivotTable.prototype.GetRowFields ();

/**
 * Returns the pivot table name.
 * @memberof ApiPivotTable
 * @returns {string}
 * @since 8.2.0
 */
ApiPivotTable.prototype.GetName = function () { return ""; };

/**
 * Sets the pivot table name.
 * @memberof ApiPivotTable
 * @param {string} name - The pivot table name.
 * @since 8.2.0
 */
ApiPivotTable.prototype.SetName = function (name) {};

/**
 * Sets the pivot table name.
 * @memberof ApiPivotTable
 * @param {string} name - The pivot table name.
 * @since 8.2.0
 */
ApiPivotTable.prototype.Name = ApiPivotTable.prototype.SetName ();

/**
 * Returns the <b>Grand Totals</b> setting of the pivot table columns.
 * @memberof ApiPivotTable
 * @returns {boolean}
 * @since 8.2.0
 */
ApiPivotTable.prototype.GetColumnGrand = function () { return true; };

/**
 * Sets the <b>Grand Totals</b> setting to the pivot table columns.
 * @memberof ApiPivotTable
 * @param {boolean} show - Specifies whether to display the grand totals for columns.
 * @since 8.2.0
 */
ApiPivotTable.prototype.SetColumnGrand = function (show) {};

/**
 * Sets the <b>Grand Totals</b> setting to the pivot table columns.
 * @memberof ApiPivotTable
 * @param {boolean} show - Specifies whether to display the grand totals for columns.
 * @since 8.2.0
 */
ApiPivotTable.prototype.ColumnGrand = ApiPivotTable.prototype.SetColumnGrand ();

/**
 * Returns the <b>Grand Totals</b> setting of the pivot table rows.
 * @memberof ApiPivotTable
 * @returns {boolean}
 * @since 8.2.0
 */
ApiPivotTable.prototype.GetRowGrand = function () { return true; };

/**
 * Sets the <b>Grand Totals</b> setting to the pivot table rows.
 * @memberof ApiPivotTable
 * @param {boolean} show - Specifies whether to display the grand totals for rows.
 * @since 8.2.0
 */
ApiPivotTable.prototype.SetRowGrand = function (show) {};

/**
 * Sets the <b>Grand Totals</b> setting to the pivot table rows.
 * @memberof ApiPivotTable
 * @param {boolean} show - Specifies whether to display the grand totals for rows.
 * @since 8.2.0
 */
ApiPivotTable.prototype.RowGrand = ApiPivotTable.prototype.SetRowGrand ();

/**
 * Specifies how the report filter fields are located.
 * @typedef {"OverThenDown" | "DownThenOver"} FieldsInReportFilterType
 */

/**
 * Returns the pivot table display fields in the report filter area settings.
 * @memberof ApiPivotTable
 * @returns {PivotTableFilterAreaInfo}
 * @since 8.2.0
 */
ApiPivotTable.prototype.GetDisplayFieldsInReportFilterArea = function () { return new PivotTableFilterAreaInfo(); };

/**
 * Sets the pivot table display fields in the report filter area settings.
 * @memberof ApiPivotTable
 * @param {FieldsInReportFilterType} type - Specifies how the report filter fields are located.
 * @param {number} fields - A number of the report filter fields.
 * @since 8.2.0
 */
ApiPivotTable.prototype.SetDisplayFieldsInReportFilterArea = function (type, fields) {};

/**
 * Returns the setting which specifies whether to display field headers for rows and columns.
 * @memberof ApiPivotTable
 * @returns {boolean}
 * @since 8.2.0
 */
ApiPivotTable.prototype.GetDisplayFieldCaptions = function () { return true; };

/**
 * Returns the setting which specifies whether to display field headers for rows and columns.
 * @memberof ApiPivotTable
 * @param {boolean} show - Specifies whether to display field headers for rows and columns.
 * @since 8.2.0
 */
ApiPivotTable.prototype.SetDisplayFieldCaptions = function (show) {};

/**
 * Returns the setting which specifies whether to display field headers for rows and columns.
 * @memberof ApiPivotTable
 * @param {boolean} show - Specifies whether to display field headers for rows and columns.
 * @since 8.2.0
 */
ApiPivotTable.prototype.DisplayFieldCaptions = ApiPivotTable.prototype.SetDisplayFieldCaptions ();

/**
 * Returns the pivot table title.
 * @memberof ApiPivotTable
 * @returns {string}
 * @since 8.2.0
 */
ApiPivotTable.prototype.GetTitle = function () { return ""; };

/**
 * Sets the pivot table title.
 * @memberof ApiPivotTable
 * @param {string} title - The pivot table title.
 * @since 8.2.0
 */
ApiPivotTable.prototype.SetTitle = function (title) {};

/**
 * Sets the pivot table title.
 * @memberof ApiPivotTable
 * @param {string} title - The pivot table title.
 * @since 8.2.0
 */
ApiPivotTable.prototype.Title = ApiPivotTable.prototype.SetTitle ();

/**
 * Returns the pivot table description.
 * @memberof ApiPivotTable
 * @returns {string}
 * @since 8.2.0
 */
ApiPivotTable.prototype.GetDescription = function () { return ""; };

/**
 * Sets the pivot table description.
 * @memberof ApiPivotTable
 * @param {string} description - The pivot table description.
 * @since 8.2.0
 */
ApiPivotTable.prototype.SetDescription = function (description) {};

/**
 * Sets the pivot table description.
 * @memberof ApiPivotTable
 * @param {string} description - The pivot table description.
 * @since 8.2.0
 */
ApiPivotTable.prototype.Description = ApiPivotTable.prototype.SetDescription ();

/**
 * Returns the pivot table style name.
 * @memberof ApiPivotTable
 * @returns {string}
 * @since 8.2.0
 */
ApiPivotTable.prototype.GetStyleName = function () { return ""; };

/**
 * Sets the pivot table style name.
 * @memberof ApiPivotTable
 * @param {string} name - The pivot table style name.
 * @since 8.2.0
 */
ApiPivotTable.prototype.SetStyleName = function (name) {};

/**
 * Sets the pivot table style name.
 * @memberof ApiPivotTable
 * @param {string} name - The pivot table style name.
 * @since 8.2.0
 */
ApiPivotTable.prototype.StyleName = ApiPivotTable.prototype.SetStyleName ();

/**
 * Returns the setting which specifies whether the row headers of the pivot table will be highlighted with the special formatting.
 * @memberof ApiPivotTable
 * @returns {boolean}
 * @since 8.2.0
 */
ApiPivotTable.prototype.GetTableStyleRowHeaders = function () { return true; };

/**
 * Sets the setting which specifies whether the row headers of the pivot table will be highlighted with the special formatting.
 * @memberof ApiPivotTable
 * @param {boolean} show - Specifies whether the row headers of the pivot table will be highlighted with the special formatting.
 * @since 8.2.0
 */
ApiPivotTable.prototype.SetTableStyleRowHeaders = function (show) {};

/**
 * Sets the setting which specifies whether the row headers of the pivot table will be highlighted with the special formatting.
 * @memberof ApiPivotTable
 * @param {boolean} show - Specifies whether the row headers of the pivot table will be highlighted with the special formatting.
 * @since 8.2.0
 */
ApiPivotTable.prototype.ShowTableStyleRowHeaders = ApiPivotTable.prototype.SetTableStyleRowHeaders ();

/**
 * Returns the setting which specifies whether the column headers of the pivot table will be highlighted with the special formatting.
 * @memberof ApiPivotTable
 * @returns {boolean}
 * @since 8.2.0
 */
ApiPivotTable.prototype.GetTableStyleColumnHeaders = function () { return true; };

/**
 * Sets the setting which specifies whether the column headers of the pivot table will be highlighted with the special formatting.
 * @memberof ApiPivotTable
 * @param {boolean} show - Specifies whether the column headers of the pivot table will be highlighted with the special formatting.
 * @since 8.2.0
 */
ApiPivotTable.prototype.SetTableStyleColumnHeaders = function (show) {};

/**
 * Sets the setting which specifies whether the column headers of the pivot table will be highlighted with the special formatting.
 * @memberof ApiPivotTable
 * @param {boolean} show - Specifies whether the column headers of the pivot table will be highlighted with the special formatting.
 * @since 8.2.0
 */
ApiPivotTable.prototype.ShowTableStyleColumnHeaders = ApiPivotTable.prototype.SetTableStyleColumnHeaders ();

/**
 * Returns the setting which specifies whether the background color alternation for odd and even rows will be enabled for the pivot table.
 * @memberof ApiPivotTable
 * @returns {boolean}
 * @since 8.2.0
 */
ApiPivotTable.prototype.GetTableStyleRowStripes = function () { return true; };

/**
 * Sets the setting which specifies whether the background color alternation for odd and even rows will be enabled for the pivot table.
 * @memberof ApiPivotTable
 * @param {boolean} show - Specifies whether the background color alternation for odd and even rows will be enabled for the pivot table.
 * @since 8.2.0
 */
ApiPivotTable.prototype.SetTableStyleRowStripes = function (show) {};

/**
 * Sets the setting which specifies whether the background color alternation for odd and even rows will be enabled for the pivot table.
 * @memberof ApiPivotTable
 * @param {boolean} show - Specifies whether the background color alternation for odd and even rows will be enabled for the pivot table.
 * @since 8.2.0
 */
ApiPivotTable.prototype.ShowTableStyleRowStripes = ApiPivotTable.prototype.SetTableStyleRowStripes ();

/**
 * Returns the setting which specifies whether the background color alternation for odd and even columns will be enabled for the pivot table.
 * @memberof ApiPivotTable
 * @returns {boolean}
 * @since 8.2.0
 */
ApiPivotTable.prototype.GetTableStyleColumnStripes = function () { return true; };

/**
 * Sets the setting which specifies whether the background color alternation for odd and even columns will be enabled for the pivot table.
 * @memberof ApiPivotTable
 * @param {boolean} show - Specifies whether the background color alternation for odd and even columns will be enabled for the pivot table.
 * @since 8.2.0
 */
ApiPivotTable.prototype.SetTableStyleColumnStripes = function (show) {};

/**
 * Sets the setting which specifies whether the background color alternation for odd and even columns will be enabled for the pivot table.
 * @memberof ApiPivotTable
 * @param {boolean} show - Specifies whether the background color alternation for odd and even columns will be enabled for the pivot table.
 * @since 8.2.0
 */
ApiPivotTable.prototype.ShowTableStyleColumnStripes = ApiPivotTable.prototype.SetTableStyleColumnStripes ();

/**
 * Returns the source range for the pivot table.
 * @memberof ApiPivotTable
 * @returns {ApiRange}
 * @since 8.2.0
 */
ApiPivotTable.prototype.GetSource = function () { return new ApiRange(); };

/**
 * Sets the source range for the pivot table.
 * @memberof ApiPivotTable
 * @param {ApiRange} source - The range where the pivot table will be located.
 * @since 8.2.0
 */
ApiPivotTable.prototype.SetSource = function (source) {};

/**
 * Sets the source range for the pivot table.
 * @memberof ApiPivotTable
 * @param {ApiRange} source - The range where the pivot table will be located.
 * @since 8.2.0
 */
ApiPivotTable.prototype.Source = ApiPivotTable.prototype.SetSource ();

/**
 * Returns a Range object that represents the column area in the pivot table report.
 * @memberof ApiPivotTable
 * @returns {ApiRange | null}
 * @since 8.2.0
 */
ApiPivotTable.prototype.GetColumnRange = function () { return new ApiRange(); };

/**
 * Returns a Range object that represents the column area in the pivot table report.
 * @memberof ApiPivotTable
 * @returns {ApiRange | null}
 * @since 8.2.0
 */
ApiPivotTable.prototype.ColumnRange = ApiPivotTable.prototype.GetColumnRange ();

/**
 * Returns a Range object that represents the row area in the pivot table report.
 * @memberof ApiPivotTable
 * @returns {ApiRange | null}
 * @since 8.2.0
 */
ApiPivotTable.prototype.GetRowRange = function () { return new ApiRange(); };

/**
 * Returns a Range object that represents the row area in the pivot table report.
 * @memberof ApiPivotTable
 * @returns {ApiRange | null}
 * @since 8.2.0
 */
ApiPivotTable.prototype.RowRange = ApiPivotTable.prototype.GetRowRange ();

/**
 * Returns a Range object that represents the range of values in the pivot table.
 * @memberof ApiPivotTable
 * @returns {ApiRange}
 * @since 8.2.0
 */
ApiPivotTable.prototype.GetDataBodyRange = function () { return new ApiRange(); };

/**
 * Returns a Range object that represents the range of values in the pivot table.
 * @memberof ApiPivotTable
 * @returns {ApiRange}
 * @since 8.2.0
 */
ApiPivotTable.prototype.DataBodyRange = ApiPivotTable.prototype.GetDataBodyRange ();

/**
 * Returns a Range object that represents the entire pivot table report, but doesn't include page fields.
 * @memberof ApiPivotTable
 * @returns {ApiRange | null}
 * @since 8.2.0
 */
ApiPivotTable.prototype.GetTableRange1 = function () { return new ApiRange(); };

/**
 * Returns a Range object that represents the entire pivot table report, but doesn't include page fields.
 * @memberof ApiPivotTable
 * @returns {ApiRange | null}
 * @since 8.2.0
 */
ApiPivotTable.prototype.TableRange1 = ApiPivotTable.prototype.GetTableRange1 ();

/**
 * Returns a Range object that represents the entire pivot table report, including page fields.
 * @memberof ApiPivotTable
 * @returns {ApiRange | null}
 * @since 8.2.0
 */
ApiPivotTable.prototype.GetTableRange2 = function () { return new ApiRange(); };

/**
 * Returns a Range object that represents the entire pivot table report, including page fields.
 * @memberof ApiPivotTable
 * @returns {ApiRange | null}
 * @since 8.2.0
 */
ApiPivotTable.prototype.TableRange2 = ApiPivotTable.prototype.GetTableRange2 ();

/**
 * Returns the text string label that is displayed in the grand total column or row heading in the specified pivot table report.
 * @memberof ApiPivotTable
 * @returns {string}
 * @since 8.2.0
 */
ApiPivotTable.prototype.GetGrandTotalName = function () { return ""; };

/**
 * Sets the text string label that is displayed in the grand total column or row heading in the specified pivot table report.
 * @memberof ApiPivotTable
 * @param {string} name - The grand total name.
 * @since 8.2.0
 */
ApiPivotTable.prototype.SetGrandTotalName = function (name) {};

/**
 * Sets the text string label that is displayed in the grand total column or row heading in the specified pivot table report.
 * @memberof ApiPivotTable
 * @param {string} name - The grand total name.
 * @since 8.2.0
 */
ApiPivotTable.prototype.GrandTotalName = ApiPivotTable.prototype.SetGrandTotalName ();

/**
 * Sets the setting which specifies whether to insert blank rows after each item.
 * @memberof ApiPivotTable
 * @param {boolean} insert - Specifies whether to insert blank rows after each item.
 * @since 8.2.0
 */
ApiPivotTable.prototype.SetLayoutBlankLine = function (insert) {};

/**
 * Sets the setting which specifies whether to insert blank rows after each item.
 * @memberof ApiPivotTable
 * @param {boolean} insert - Specifies whether to insert blank rows after each item.
 * @since 8.2.0
 */
ApiPivotTable.prototype.LayoutBlankLine = ApiPivotTable.prototype.SetLayoutBlankLine ();

/**
 * Sets the setting which specifies whether to show subtotals.
 * @memberof ApiPivotTable
 * @param {boolean} show - Specifies whether to show subtotals.
 * @since 8.2.0
 */
ApiPivotTable.prototype.SetLayoutSubtotals = function (show) {};

/**
 * Sets the setting which specifies whether to show subtotals.
 * @memberof ApiPivotTable
 * @param {boolean} show - Specifies whether to show subtotals.
 * @since 8.2.0
 */
ApiPivotTable.prototype.LayoutSubtotals = ApiPivotTable.prototype.SetLayoutSubtotals ();

/**
 * Returns the parent object for the current pivot table.
 * @memberof ApiPivotTable
 * @returns {ApiWorksheet} - The parent object for the current pivot table.
 * @since 8.2.0
 */
ApiPivotTable.prototype.GetParent = function () { return new ApiWorksheet(); };

/**
 * Returns the parent object for the current pivot table.
 * @memberof ApiPivotTable
 * @returns {ApiWorksheet} - The parent object for the current pivot table.
 * @since 8.2.0
 */
ApiPivotTable.prototype.Parent = ApiPivotTable.prototype.GetParent ();

/** Methods */

/**
 * Removes  the current data field from the category.
 * @memberof ApiPivotDataField
 * @since 8.2.0
 */
ApiPivotDataField.prototype.Remove = function () {};

/**
 * Moves the current data field inside the category.
 * @memberof ApiPivotDataField
 * @param {PivotMoveFieldType | PivotFieldOrientationType} type - The direction to move the pivot table field,
 * or the pivot field orientation type.
 * @param {number} [index] - The index of the data field in a new category.
 * @since 8.2.0
 */
ApiPivotDataField.prototype.Move = function (type, index) {};

/** Attributes */

/**
 * The type of calculation to perform on the data field items.
 * @typedef {"Average" | "CountNumbers" | "Count" | "Max" | "Min" | "Product" |
 * "StdDev" | "StdDevP" | "Sum" | "Var" | "VarP"} DataConsolidateFunctionType
 */

/**
 * Sets a function to the current data field.
 * @memberof ApiPivotDataField
 * @param {DataConsolidateFunctionType} func - The function to perform in the added data field.
 * @since 8.2.0
 */
ApiPivotDataField.prototype.SetFunction = function (func) {};

/**
 * Returns a function performed in the data field.
 * @memberof ApiPivotDataField
 * @returns {DataConsolidateFunctionType} func - The function performed in the added data field.
 * @since 8.2.0
 */
ApiPivotDataField.prototype.GetFunction = function () { return new DataConsolidateFunctionType(); };

/**
 * Returns a value that represents the data field position within a category.
 * @memberof ApiPivotDataField
 * @returns {number}
 * @since 8.2.0
 */
ApiPivotDataField.prototype.GetPosition = function () { return 0; };

/**
 * Sets a value that represents the data field position within a category.
 * @memberof ApiPivotDataField
 * @param {number} position - The data field position.
 * @since 8.2.0
 */
ApiPivotDataField.prototype.SetPosition = function (position) {};

/**
 * Sets a value that represents the data field position within a category.
 * @memberof ApiPivotDataField
 * @param {number} position - The data field position.
 * @since 8.2.0
 */
ApiPivotDataField.prototype.Position = ApiPivotDataField.prototype.SetPosition ();

/**
 * Returns a data field orientation value that represents the data field location in the specified pivot table report.
 * @memberof ApiPivotDataField
 * @returns {PivotFieldOrientationType}
 * @since 8.2.0
 */
ApiPivotDataField.prototype.GetOrientation = function () { return new PivotFieldOrientationType(); };

/**
 * Returns a data field orientation value that represents the data field location in the specified pivot table report.
 * @memberof ApiPivotDataField
 * @returns {PivotFieldOrientationType}
 * @since 8.2.0
 */
ApiPivotDataField.prototype.Orientation = ApiPivotDataField.prototype.GetOrientation ();

/**
 * Returns a value representing the name of the specified data field in the pivot table report.
 * @memberof ApiPivotDataField
 * @returns {string}
 * @since 8.2.0
 */
ApiPivotDataField.prototype.GetValue = function () { return ""; };

/**
 * Sets a value representing the name of the specified data field in the pivot table report.
 * @memberof ApiPivotDataField
 * @param {string} name - The name of the specified field in the pivot table report.
 * @since 8.2.0
 */
ApiPivotDataField.prototype.SetValue = function (name) {};

/**
 * Sets a value representing the name of the specified data field in the pivot table report.
 * @memberof ApiPivotDataField
 * @param {string} name - The name of the specified field in the pivot table report.
 * @since 8.2.0
 */
ApiPivotDataField.prototype.Value = ApiPivotDataField.prototype.SetValue ();

/**
 * Returns a value that represents the label text for the data field.
 * @memberof ApiPivotDataField
 * @returns {string}
 * @since 8.2.0
 */
ApiPivotDataField.prototype.GetCaption = function () { return ""; };

/**
 * Sets a value that represents the label text for the data field.
 * @memberof ApiPivotDataField
 * @param {string} caption - The label text for the data field.
 * @since 8.2.0
 */
ApiPivotDataField.prototype.SetCaption = function (caption) {};

/**
 * Sets a value that represents the label text for the data field.
 * @memberof ApiPivotDataField
 * @param {string} caption - The label text for the data field.
 * @since 8.2.0
 */
ApiPivotDataField.prototype.Caption = ApiPivotDataField.prototype.SetCaption ();

/**
 * Returns a value representing the object name.
 * @memberof ApiPivotDataField
 * @returns {string}
 * @since 8.2.0
 */
ApiPivotDataField.prototype.GetName = function () { return ""; };

/**
 * Sets a value representing the object name.
 * @memberof ApiPivotDataField
 * @param {string} name - The object name.
 * @since 8.2.0
 */
ApiPivotDataField.prototype.SetName = function (name) {};

/**
 * Sets a value representing the object name.
 * @memberof ApiPivotDataField
 * @param {string} name - The object name.
 * @since 8.2.0
 */
ApiPivotDataField.prototype.Name = ApiPivotDataField.prototype.SetName ();

/**
 * Returns a value that represents the format code for the object.
 * @memberof ApiPivotDataField
 * @returns {string | null}
 * @since 8.2.0
 */
ApiPivotDataField.prototype.GetNumberFormat = function () { return ""; };

/**
 * Sets a value that represents the format code for the object.
 * @memberof ApiPivotDataField
 * @param {string} format - The format code for the object.
 * @since 8.2.0
 */
ApiPivotDataField.prototype.SetNumberFormat = function (format) {};

/**
 * Sets a value that represents the format code for the object.
 * @memberof ApiPivotDataField
 * @param {string} format - The format code for the object.
 * @since 8.2.0
 */
ApiPivotDataField.prototype.NumberFormat = ApiPivotDataField.prototype.SetNumberFormat ();

/**
 * Returns an index of the data field.
 * @memberof ApiPivotDataField
 * @returns {number}
 * @since 8.2.0
 */
ApiPivotDataField.prototype.GetIndex = function () { return 0; };

/**
 * Returns an index of the data field.
 * @memberof ApiPivotDataField
 * @returns {number}
 * @since 8.2.0
 */
ApiPivotDataField.prototype.Index = ApiPivotDataField.prototype.GetIndex ();

/**
 * Returns the pivot field from which the data field was created.
 * @memberof ApiPivotDataField
 * @returns {ApiPivotField}
 * @since 8.2.0
 */
ApiPivotDataField.prototype.GetPivotField = function () { return new ApiPivotField(); };

/**
 * Returns the pivot field from which the data field was created.
 * @memberof ApiPivotDataField
 * @returns {ApiPivotField}
 * @since 8.2.0
 */
ApiPivotDataField.prototype.PivotField = ApiPivotDataField.prototype.GetPivotField ();

/** Methods */

/**
 * Deletes all filters currently applied to the pivot field.
 * @memberof ApiPivotField
 * @since 8.2.0
 */
ApiPivotField.prototype.ClearAllFilters  = function () {};

/**
 * Deletes all label filters or all date filters from the pivot filters collection.
 * @memberof ApiPivotField
 * @since 8.2.0
 */
ApiPivotField.prototype.ClearLabelFilters  = function () {};

/**
 * Deletes all manual filters from the pivot filters collection.
 * @memberof ApiPivotField
 * @since 8.2.0
 */
ApiPivotField.prototype.ClearManualFilters  = function () {};

/**
 * Deletes all value filters from the pivot filters collection.
 * @memberof ApiPivotField
 * @since 8.2.0
 */
ApiPivotField.prototype.ClearValueFilters  = function () {};

/**
 * Returns an object that represents either a single pivot table item (the ApiPivotItem object)
 * or a collection of all the visible and hidden items (an array of the ApiPivotItem objects) in the specified field.
 * @memberof ApiPivotField
 * @param {number} [index] - The item index.
 * @returns {ApiPivotItem[] | ApiPivotItem | null}
 * @since 8.2.0
 */
ApiPivotField.prototype.GetPivotItems = function (index) { return [new ApiPivotItem()]; };

/**
 * Returns an object that represents either a single pivot table item (the ApiPivotItem object)
 * or a collection of all the visible and hidden items (an array of the ApiPivotItem objects) in the specified field.
 * @memberof ApiPivotField
 * @param {number} [index] - The item index.
 * @returns {ApiPivotItem[] | ApiPivotItem | null}
 * @since 8.2.0
 */
ApiPivotField.prototype.PivotItems = ApiPivotField.prototype.GetPivotItems ();

/**
 * Moves the current pivot field inside the category.
 * @memberof ApiPivotField
 * @param {PivotMoveFieldType | PivotFieldOrientationType} type - The direction to move the pivot table field,
 * or the pivot field orientation type.
 * @param {number | undefined} index - The field index in a new category.
 * @since 8.2.0
 */
ApiPivotField.prototype.Move = function (type, index) {};

/**
 * Removes the current pivot field from the pivot table.
 * @memberof ApiPivotField
 * @since 8.2.0
 */
ApiPivotField.prototype.Remove = function () {};

/** Attributes */

/**
 * Returns a value that represents the position of the field (first, second, third, and so on)
 * among all the fields in its orientation (Rows, Columns, Pages, Data).
 * @memberof ApiPivotField
 * @returns {number}
 * @since 8.2.0
 */
ApiPivotField.prototype.GetPosition = function () { return 0; };

/**
 * Sets a value that represents the position of the field (first, second, third, and so on)
 * among all the fields in its orientation (Rows, Columns, Pages, Data).
 * @memberof ApiPivotField
 * @param {number} position - The field position.
 * @since 8.2.0
 */
ApiPivotField.prototype.SetPosition = function (position) {};

/**
 * Sets a value that represents the position of the field (first, second, third, and so on)
 * among all the fields in its orientation (Rows, Columns, Pages, Data).
 * @memberof ApiPivotField
 * @param {number} position - The field position.
 * @since 8.2.0
 */
ApiPivotField.prototype.Position = ApiPivotField.prototype.SetPosition ();

/**
 * Returns a pivot field orientation value that represents the location
 * of the field in the specified pivot table report.
 * @memberof ApiPivotField
 * @returns {PivotFieldOrientationType}
 * @since 8.2.0
 */
ApiPivotField.prototype.GetOrientation = function () { return new PivotFieldOrientationType(); };

/**
 * Sets a pivot field orientation value that represents the location
 * of the field in the specified pivot table report.
 * @memberof ApiPivotField
 * @param {PivotFieldOrientationType} type - The pivot field orientation type.
 * @since 8.2.0
 */
ApiPivotField.prototype.SetOrientation = function (type) {};

/**
 * Sets a pivot field orientation value that represents the location
 * of the field in the specified pivot table report.
 * @memberof ApiPivotField
 * @param {PivotFieldOrientationType} type - The pivot field orientation type.
 * @since 8.2.0
 */
ApiPivotField.prototype.Orientation = ApiPivotField.prototype.SetOrientation ();

/**
 * Returns a value representing the name of the specified field in the pivot table report.
 * @memberof ApiPivotField
 * @returns {string}
 * @since 8.2.0
 */
ApiPivotField.prototype.GetValue = function () { return ""; };

/**
 * Sets a value representing the name of the specified field in the pivot table report.
 * @memberof ApiPivotField
 * @param {string} name - The name of the specified field in the pivot table report.
 * @since 8.2.0
 */
ApiPivotField.prototype.SetValue = function (name) {};

/**
 * Sets a value representing the name of the specified field in the pivot table report.
 * @memberof ApiPivotField
 * @param {string} name - The name of the specified field in the pivot table report.
 * @since 8.2.0
 */
ApiPivotField.prototype.Value = ApiPivotField.prototype.SetValue ();

/**
 * Returns a value that represents the label text for the pivot field.
 * @memberof ApiPivotField
 * @returns {string}
 * @since 8.2.0
 */
ApiPivotField.prototype.GetCaption = function () { return ""; };

/**
 * Sets a value that represents the label text for the pivot field.
 * @memberof ApiPivotField
 * @param {string} caption - The label text for the pivot field.
 * @since 8.2.0
 */
ApiPivotField.prototype.SetCaption = function (caption) {};

/**
 * Sets a value that represents the label text for the pivot field.
 * @memberof ApiPivotField
 * @param {string} caption - The label text for the pivot field.
 * @since 8.2.0
 */
ApiPivotField.prototype.Caption = ApiPivotField.prototype.SetCaption ();

/**
 * Returns a value representing the object name.
 * @memberof ApiPivotField
 * @returns {string}
 * @since 8.2.0
 */
ApiPivotField.prototype.GetName = function () { return ""; };

/**
 * Sets a value representing the object name.
 * @memberof ApiPivotField
 * @param {string} name - The object name.
 * @since 8.2.0
 */
ApiPivotField.prototype.SetName = function (name) {};

/**
 * Sets a value representing the object name.
 * @memberof ApiPivotField
 * @param {string} name - The object name.
 * @since 8.2.0
 */
ApiPivotField.prototype.Name = ApiPivotField.prototype.SetName ();

/**
 * Returns a source name for the pivot table field.
 * @memberof ApiPivotField
 * @returns {string}
 * @since 8.2.0
 */
ApiPivotField.prototype.GetSourceName = function () { return ""; };

/**
 * Returns a source name for the pivot table field.
 * @memberof ApiPivotField
 * @returns {string}
 * @since 8.2.0
 */
ApiPivotField.prototype.SourceName = ApiPivotField.prototype.GetSourceName ();

/**
 * Returns an index for the pivot table field.
 * @memberof ApiPivotField
 * @returns {number}
 * @since 8.2.0
 */
ApiPivotField.prototype.GetIndex = function () { return 0; };

/**
 * Returns an index for the pivot table field.
 * @memberof ApiPivotField
 * @returns {number}
 * @since 8.2.0
 */
ApiPivotField.prototype.Index = ApiPivotField.prototype.GetIndex ();

/**
 * Returns the ApiPivotTable object which represents the pivot table for the current field.
 * @memberof ApiPivotField
 * @returns {ApiPivotTable}
 * @since 8.2.0
 */
ApiPivotField.prototype.GetTable = function () { return new ApiPivotTable(); };

/**
 * Returns the ApiPivotTable object which represents the pivot table for the current field.
 * @memberof ApiPivotField
 * @returns {ApiPivotTable}
 * @since 8.2.0
 */
ApiPivotField.prototype.Table = ApiPivotField.prototype.GetTable ();

/**
 * Returns the parent object for the current field.
 * @memberof ApiPivotField
 * @returns {ApiPivotTable}
 * @since 8.2.0
 */
ApiPivotField.prototype.GetParent = function () { return new ApiPivotTable(); };

/**
 * Returns the parent object for the current field.
 * @memberof ApiPivotField
 * @returns {ApiPivotTable}
 * @since 8.2.0
 */
ApiPivotField.prototype.Parent = ApiPivotField.prototype.GetParent ();

/**
 * Returns the setting which specifies whether a pivot table field is compacted.
 * @memberof ApiPivotField
 * @returns {boolean}
 * @since 8.2.0
 */
ApiPivotField.prototype.GetLayoutCompactRow = function () { return true; };

/**
 * Sets the setting which specifies whether a pivot table field is compacted.
 * @memberof ApiPivotField
 * @param {boolean} compact - Specifies whether a pivot table field is compacted.
 * @since 8.2.0
 */
ApiPivotField.prototype.SetLayoutCompactRow = function (compact) {};

/**
 * Sets the setting which specifies whether a pivot table field is compacted.
 * @memberof ApiPivotField
 * @param {boolean} compact - Specifies whether a pivot table field is compacted.
 * @since 8.2.0
 */
ApiPivotField.prototype.LayoutCompactRow = ApiPivotField.prototype.SetLayoutCompactRow ();

/**
 * The layout type of the pivot table report.
 * @typedef {"Tabular" | "Outline"} PivotLayoutType
 */

/**
 * Returns the way the specified pivot table items appear — in table format or in outline format.
 * @memberof ApiPivotField
 * @returns {PivotLayoutType}
 * @since 8.2.0
 */
ApiPivotField.prototype.GetLayoutForm = function () { return new PivotLayoutType(); };

/**
 * Sets the way the specified pivot table items appear — in table format or in outline format.
 * @memberof ApiPivotField
 * @param {PivotLayoutType} type - The layout type of the pivot table report.
 * @since 8.2.0
 */
ApiPivotField.prototype.SetLayoutForm = function (type) {};

/**
 * Sets the way the specified pivot table items appear — in table format or in outline format.
 * @memberof ApiPivotField
 * @param {PivotLayoutType} type - The layout type of the pivot table report.
 * @since 8.2.0
 */
ApiPivotField.prototype.LayoutForm = ApiPivotField.prototype.SetLayoutForm ();

/**
 * Returns the setting which specifies whether to insert a page break after each field.
 * @memberof ApiPivotField
 * @returns {boolean}
 * @since 8.2.0
 */
ApiPivotField.prototype.GetLayoutPageBreak = function () { return true; };

/**
 * Sets the setting which specifies whether to insert a page break after each field.
 * @memberof ApiPivotField
 * @param {boolean} insert - Specifies whether to insert a page break after each field.
 * @since 8.2.0
 */
ApiPivotField.prototype.SetLayoutPageBreak = function (insert) {};

/**
 * Sets the setting which specifies whether to insert a page break after each field.
 * @memberof ApiPivotField
 * @param {boolean} insert - Specifies whether to insert a page break after each field.
 * @since 8.2.0
 */
ApiPivotField.prototype.LayoutPageBreak = ApiPivotField.prototype.SetLayoutPageBreak ();

/**
 * Returns the setting which specifies whether the pivot table field is currently visible in the pivot table.
 * @memberof ApiPivotField
 * @returns {boolean}
 * @since 8.2.0
 */
ApiPivotField.prototype.GetShowingInAxis = function () { return true; };

/**
 * Returns the setting which specifies whether the pivot table field is currently visible in the pivot table.
 * @memberof ApiPivotField
 * @returns {boolean}
 * @since 8.2.0
 */
ApiPivotField.prototype.ShowingInAxis = ApiPivotField.prototype.GetShowingInAxis ();

/**
 * Returns the setting which specifies whether to repeat items labels at each row.
 * @memberof ApiPivotField
 * @returns {boolean}
 * @since 8.2.0
 */
ApiPivotField.prototype.GetRepeatLabels = function () { return true; };

/**
 * Sets the setting which specifies whether to repeat items labels at each row.
 * @memberof ApiPivotField
 * @param {boolean} repeat - Specifies whether to repeat items labels at each row.
 * @since 8.2.0
 */
ApiPivotField.prototype.SetRepeatLabels = function (repeat) {};

/**
 * Sets the setting which specifies whether to repeat items labels at each row.
 * @memberof ApiPivotField
 * @param {boolean} repeat - Specifies whether to repeat items labels at each row.
 * @since 8.2.0
 */
ApiPivotField.prototype.RepeatLabels = ApiPivotField.prototype.SetRepeatLabels ();

/**
 * Returns the setting which specifies whether to insert blank rows after each item.
 * @memberof ApiPivotField
 * @returns {boolean}
 * @since 8.2.0
 */
ApiPivotField.prototype.GetLayoutBlankLine = function () { return true; };

/**
 * Sets the setting which specifies whether to insert blank rows after each item.
 * @memberof ApiPivotField
 * @param {boolean} insert - Specifies whether to insert blank rows after each item.
 * @since 8.2.0
 */
ApiPivotField.prototype.SetLayoutBlankLine = function (insert) {};

/**
 * Sets the setting which specifies whether to insert blank rows after each item.
 * @memberof ApiPivotField
 * @param {boolean} insert - Specifies whether to insert blank rows after each item.
 * @since 8.2.0
 */
ApiPivotField.prototype.LayoutBlankLine = ApiPivotField.prototype.SetLayoutBlankLine ();

/**
 * Returns the setting which specifies whether to show items with no data.
 * @memberof ApiPivotField
 * @returns {boolean}
 * @since 8.2.0
 */
ApiPivotField.prototype.GetShowAllItems = function () { return true; };

/**
 * Sets the setting which specifies whether to show items with no data.
 * @memberof ApiPivotField
 * @param {boolean} show - Specifies whether to show items with no data.
 * @since 8.2.0
 */
ApiPivotField.prototype.SetShowAllItems = function (show) {};

/**
 * Sets the setting which specifies whether to show items with no data.
 * @memberof ApiPivotField
 * @param {boolean} show - Specifies whether to show items with no data.
 * @since 8.2.0
 */
ApiPivotField.prototype.ShowAllItems = ApiPivotField.prototype.SetShowAllItems ();

/**
 * Returns the setting which specifies whether to show subtotals.
 * @memberof ApiPivotField
 * @returns {boolean}
 * @since 8.2.0
 */
ApiPivotField.prototype.GetLayoutSubtotals = function () { return true; };

/**
 * Sets the setting which specifies whether to show subtotals.
 * @memberof ApiPivotField
 * @param {boolean} show - Specifies whether to show subtotals.
 * @since 8.2.0
 */
ApiPivotField.prototype.SetLayoutSubtotals = function (show) {};

/**
 * Sets the setting which specifies whether to show subtotals.
 * @memberof ApiPivotField
 * @param {boolean} show - Specifies whether to show subtotals.
 * @since 8.2.0
 */
ApiPivotField.prototype.LayoutSubtotals = ApiPivotField.prototype.SetLayoutSubtotals ();

/**
 * The layout subtotal location. 
 * @typedef { "Top" | "Bottom" } LayoutSubtotalLocationType
 */

/**
 * Returns the layout subtotal location.
 * @memberof ApiPivotField
 * @returns {LayoutSubtotalLocationType}
 * @since 8.2.0
 */
ApiPivotField.prototype.GetLayoutSubtotalLocation = function () { return new LayoutSubtotalLocationType(); };

/**
 * Sets the layout subtotal location.
 * @memberof ApiPivotField
 * @param {LayoutSubtotalLocationType} type - The layout subtotal location.
 * @since 8.2.0
 */
ApiPivotField.prototype.SetLayoutSubtotalLocation = function (type) {};

/**
 * Sets the layout subtotal location.
 * @memberof ApiPivotField
 * @param {LayoutSubtotalLocationType} type - The layout subtotal location.
 * @since 8.2.0
 */
ApiPivotField.prototype.LayoutSubtotalLocation = ApiPivotField.prototype.SetLayoutSubtotalLocation ();

/**
 * Returns the text label displayed in the subtotal column or row heading in the specified pivot table report.
 * @memberof ApiPivotField
 * @returns {string}
 * @since 8.2.0
 */
ApiPivotField.prototype.GetSubtotalName = function () { return ""; };

/**
 * Sets the text label displayed in the subtotal column or row heading in the specified pivot table report.
 * @memberof ApiPivotField
 * @param {string} caption - The text label displayed in the subtotal column or row heading.
 * @since 8.2.0
 */
ApiPivotField.prototype.SetSubtotalName = function (caption) {};

/**
 * Sets the text label displayed in the subtotal column or row heading in the specified pivot table report.
 * @memberof ApiPivotField
 * @param {string} caption - The text label displayed in the subtotal column or row heading.
 * @since 8.2.0
 */
ApiPivotField.prototype.SubtotalName = ApiPivotField.prototype.SetSubtotalName ();

/**
 * Subtotal pivot field types (functions for subtotals).
 * @typedef {Object} PivotFieldSubtotals
 * @property {boolean} Sum - Specififes whether the SUM function will be used.
 * @property {boolean} Count - Specififes whether the COUNTA function will be used.
 * @property {boolean} Average - Specififes whether the AVERAGE function will be used.
 * @property {boolean} Max - Specififes whether the MAX function will be used.
 * @property {boolean} Min - Specififes whether the MIN function will be used.
 * @property {boolean} Product - Specififes whether the PRODUCT function will be used.
 * @property {boolean} CountNumbers - Specififes whether the COUNT function will be used.
 * @property {boolean} StdDev - Specififes whether the STDEV function will be used.
 * @property {boolean} StdDevP - Specififes whether the STDEV.P function will be used.
 * @property {boolean} Var - Specififes whether the VAR function will be used.
 * @property {boolean} VarP - Specififes whether the VAR.P function will be used.
 */

/**
 * Returns an object that represents all subtotals.
 * @memberof ApiPivotField
 * @returns {PivotFieldSubtotals}
 * @since 8.2.0
 */
ApiPivotField.prototype.GetSubtotals = function () { return new PivotFieldSubtotals(); };

/**
 * Sets an object that represents all subtotals.
 * @memberof ApiPivotField
 * @param {PivotFieldSubtotals} subtotals - An object that represents all subtotals or some of them.
 * @since 8.2.0
 */
ApiPivotField.prototype.SetSubtotals = function (subtotals) {};

/**
 * Sets an object that represents all subtotals.
 * @memberof ApiPivotField
 * @param {PivotFieldSubtotals} subtotals - An object that represents all subtotals or some of them.
 * @since 8.2.0
 */
ApiPivotField.prototype.Subtotals = ApiPivotField.prototype.SetSubtotals ();

/**
 * Returns the setting which specifies whether the specified field can be dragged to the column position.
 * @memberof ApiPivotField
 * @returns {boolean}
 * @since 8.2.0
 */
ApiPivotField.prototype.GetDragToColumn = function () { return true; };

/**
 * Sets the setting which specifies whether the specified field can be dragged to the column position.
 * @memberof ApiPivotField
 * @param {boolean} flag - Specifies whether the specified field can be dragged to the column position.
 * @since 8.2.0
 */
ApiPivotField.prototype.SetDragToColumn = function (flag) {};

/**
 * Sets the setting which specifies whether the specified field can be dragged to the column position.
 * @memberof ApiPivotField
 * @param {boolean} flag - Specifies whether the specified field can be dragged to the column position.
 * @since 8.2.0
 */
ApiPivotField.prototype.DragToColumn = ApiPivotField.prototype.SetDragToColumn ();

/**
 * Returns the setting which specifies whether the specified field can be dragged to the row position.
 * @memberof ApiPivotField
 * @returns {boolean}
 * @since 8.2.0
 */
ApiPivotField.prototype.GetDragToRow = function () { return true; };

/**
 * Sets the setting which specifies whether the specified field can be dragged to the row position.
 * @memberof ApiPivotField
 * @param {boolean} flag - Specifies whether the specified field can be dragged to the row position.
 * @since 8.2.0
 */
ApiPivotField.prototype.SetDragToRow = function (flag) {};

/**
 * Sets the setting which specifies whether the specified field can be dragged to the row position.
 * @memberof ApiPivotField
 * @param {boolean} flag - Specifies whether the specified field can be dragged to the row position.
 * @since 8.2.0
 */
ApiPivotField.prototype.DragToRow = ApiPivotField.prototype.SetDragToRow ();

/**
 * Returns the setting which specifies whether the specified field can be dragged to the data position.
 * @memberof ApiPivotField
 * @returns {boolean}
 * @since 8.2.0
 */
ApiPivotField.prototype.GetDragToData = function () { return true; };

/**
 * Sets the setting which specifies whether the specified field can be dragged to the data position.
 * @memberof ApiPivotField
 * @param {boolean} flag - Specifies whether the specified field can be dragged to the data position.
 * @since 8.2.0
 */
ApiPivotField.prototype.SetDragToData = function (flag) {};

/**
 * Sets the setting which specifies whether the specified field can be dragged to the data position.
 * @memberof ApiPivotField
 * @param {boolean} flag - Specifies whether the specified field can be dragged to the data position.
 * @since 8.2.0
 */
ApiPivotField.prototype.DragToData = ApiPivotField.prototype.SetDragToData ();

/**
 * Returns the setting which specifies whether the specified field can be dragged to the page position.
 * @memberof ApiPivotField
 * @returns {boolean}
 * @since 8.2.0
 */
ApiPivotField.prototype.GetDragToPage = function () { return true; };

/**
 * Sets the setting which specifies whether the specified field can be dragged to the page position.
 * @memberof ApiPivotField
 * @param {boolean} flag - Specifies whether the specified field can be dragged to the page position.
 * @since 8.2.0
 */
ApiPivotField.prototype.SetDragToPage = function (flag) {};

/**
 * Sets the setting which specifies whether the specified field can be dragged to the page position.
 * @memberof ApiPivotField
 * @param {boolean} flag - Specifies whether the specified field can be dragged to the page position.
 * @since 8.2.0
 */
ApiPivotField.prototype.DragToPage = ApiPivotField.prototype.SetDragToPage ();

/**
 * Returns the current page which is displayed for the page field (valid only for page fields).
 * @memberof ApiPivotField
 * @returns {string | number}
 * @since 8.2.0
 */
ApiPivotField.prototype.GetCurrentPage = function () { return ""; };

/**
 * Returns the current page which is displayed for the page field (valid only for page fields).
 * @memberof ApiPivotField
 * @returns {string | number}
 * @since 8.2.0
 */
ApiPivotField.prototype.CurrentPage = ApiPivotField.prototype.GetCurrentPage ();

/**
 * Returns the collection of pivot filters applied to the specified pivot field.
 * @memberof ApiPivotField
 * @returns {ApiPivotFilters}
 * @since 9.1.0
 */
ApiPivotField.prototype.GetPivotFilters = function () { return new ApiPivotFilters(); };

/**
 * Returns the collection of pivot filters applied to the specified pivot field.
 * @memberof ApiPivotField
 * @returns {ApiPivotFilters}
 * @since 9.1.0
 */
ApiPivotField.prototype.PivotFilters = ApiPivotField.prototype.GetPivotFilters ();

/**
 * Establishes automatic field-sorting rules for PivotTable reports.
 * @memberof ApiPivotField
 * @param {SortOrder} order - The sort order.
 * @param {string} field - The name of the field to sort by(pivotField.SourceName, pivotField.Name, dataField.Name).
 * @since 9.1.0
 */
ApiPivotField.prototype.AutoSort = function (order, field) {};

/**
 * Establishes automatic field-sorting rules for PivotTable reports.
 * @memberof ApiPivotField
 * @param {SortOrder} order - The sort order.
 * @param {string} field - The name of the field to sort by(pivotField.SourceName, pivotField.Name, dataField.Name).
 * @since 9.1.0
 */
ApiPivotField.prototype.AutoSortField = ApiPivotField.prototype.AutoSort ();

/**
 * Class representing a collection of pivot filters applied to a pivot field.
 * @constructor
 * @param {ApiPivotField} field - The pivot field that owns this filter collection.
 */
function ApiPivotFilters(field) {}

/** @type {ApiPivotField} */

/**
 * Pivot filter type.
 * @typedef {("xlAfter" | "xlAfterOrEqualTo" | "xlAllDatesInPeriodApril" | "xlAllDatesInPeriodAugust" | "xlAllDatesInPeriodDecember" | "xlAllDatesInPeriodFebruary" | "xlAllDatesInPeriodJanuary" | "xlAllDatesInPeriodJuly" | "xlAllDatesInPeriodJune" | "xlAllDatesInPeriodMarch" | "xlAllDatesInPeriodMay" | "xlAllDatesInPeriodNovember" | "xlAllDatesInPeriodOctober" | "xlAllDatesInPeriodQuarter1" | "xlAllDatesInPeriodQuarter2" | "xlAllDatesInPeriodQuarter3" | "xlAllDatesInPeriodQuarter4" | "xlAllDatesInPeriodSeptember" | "xlBefore" | "xlBeforeOrEqualTo" | "xlBottomCount" | "xlBottomPercent" | "xlBottomSum" | "xlCaptionBeginsWith" | "xlCaptionContains" | "xlCaptionDoesNotBeginWith" | "xlCaptionDoesNotContain" | "xlCaptionDoesNotEndWith" | "xlCaptionDoesNotEqual" | "xlCaptionEndsWith" | "xlCaptionEquals" | "xlCaptionIsBetween" | "xlCaptionIsGreaterThan" | "xlCaptionIsGreaterThanOrEqualTo" | "xlCaptionIsLessThan" | "xlCaptionIsLessThanOrEqualTo" | "xlCaptionIsNotBetween" | "xlDateBetween" | "xlDateLastMonth" | "xlDateLastQuarter" | "xlDateLastWeek" | "xlDateLastYear" | "xlDateNextMonth" | "xlDateNextQuarter" | "xlDateNextWeek" | "xlDateNextYear" | "xlDateThisMonth" | "xlDateThisQuarter" | "xlDateThisWeek" | "xlDateThisYear" | "xlDateToday" | "xlDateTomorrow" | "xlDateYesterday" | "xlNotSpecificDate" | "xlSpecificDate" | "xlTopCount" | "xlTopPercent" | "xlTopSum" | "xlValueDoesNotEqual" | "xlValueEquals" | "xlValueIsBetween" | "xlValueIsGreaterThan" | "xlValueIsGreaterThanOrEqualTo" | "xlValueIsLessThan" | "xlValueIsLessThanOrEqualTo" | "xlValueIsNotBetween" | "xlYearToDate") } XlPivotFilterType
 */

/**
 * Adds a new filter to the pivot field. This method is VBA-compatible and follows the PivotFilters.Add signature from Excel VBA.
 * Supports all major filter types including label filters, value filters, top/bottom filters, and date filters.
 * @memberof ApiPivotFilters
 * @param {XlPivotFilterType} filterType - The type of filter to add. Must match VBA XlPivotFilterType enum values.
 * @param {ApiPivotDataField} [dataField] - The data field object to filter by. Required for value filters (xlValue* types) and top/bottom filters.
 * @param {string | number | Date} [value1] - The first value for the filter condition. Required for comparison filters, between filters, and top/bottom count.
 * @param {string | number | Date} [value2] - The second value for "Between" conditions (xlCaptionIsBetween, xlCaptionIsNotBetween, xlValueIsBetween).
 * @param {boolean} [wholeDayFilter] - Whether to filter by whole day for date filters. Reserved for future use, currently not implemented.
 * @since 9.1.0
 */
ApiPivotFilters.prototype.Add = function (filterType, dataField, value1, value2, wholeDayFilter) {};

/**
 * Returns a name of the pivot item.
 * @memberof ApiPivotItem
 * @returns {string}
 * @since 8.2.0
 */
ApiPivotItem.prototype.GetName = function () { return ""; };

/**
 * Returns a name of the pivot item.
 * @memberof ApiPivotItem
 * @returns {string}
 * @since 8.2.0
 */
ApiPivotItem.prototype.Name = ApiPivotItem.prototype.GetName ();

/**
 * Returns a caption of the pivot item.
 * @memberof ApiPivotItem
 * @returns {string}
 * @since 8.2.0
 */
ApiPivotItem.prototype.GetCaption = function () { return ""; };

/**
 * Returns a caption of the pivot item.
 * @memberof ApiPivotItem
 * @returns {string}
 * @since 8.2.0
 */
ApiPivotItem.prototype.Caption = ApiPivotItem.prototype.GetCaption ();

/**
 * Returns a name of the specified item in the pivot table field.
 * @memberof ApiPivotItem
 * @returns {string}
 * @since 8.2.0
 */
ApiPivotItem.prototype.GetValue = function () { return ""; };

/**
 * Returns a name of the specified item in the pivot table field.
 * @memberof ApiPivotItem
 * @returns {string}
 * @since 8.2.0
 */
ApiPivotItem.prototype.Value = ApiPivotItem.prototype.GetValue ();

/**
 * Returns a parent of the pivot item.
 * @memberof ApiPivotItem
 * @returns {ApiPivotField}
 * @since 8.2.0
 */
ApiPivotItem.prototype.GetParent = function () { return new ApiPivotField(); };

/**
 * Returns a parent of the pivot item.
 * @memberof ApiPivotItem
 * @returns {ApiPivotField}
 * @since 8.2.0
 */
ApiPivotItem.prototype.Parent = ApiPivotItem.prototype.GetParent ();

/**
 * Returns the visibility of the pivot item.
 * @memberof ApiPivotItem
 * @returns {boolean} True if the pivot item is visible, false otherwise.
 * @since 9.1.0
 */
ApiPivotItem.prototype.GetVisible = function () { return true; };

/**
 * Sets the visibility of the pivot item.
 * Important: ensure at least one stays visible while hiding others
 * @memberof ApiPivotItem
 * @param {boolean} visible - Specifies whether the pivot item should be visible.
 * @since 9.1.0
 */
ApiPivotItem.prototype.SetVisible = function (visible) {};

/**
 * Sets the visibility of the pivot item.
 * Important: ensure at least one stays visible while hiding others
 * @memberof ApiPivotItem
 * @param {boolean} visible - Specifies whether the pivot item should be visible.
 * @since 9.1.0
 */
ApiPivotItem.prototype.Visible = ApiPivotItem.prototype.SetVisible ();

/**
 * The validation type.
 * @typedef {("xlValidateInputOnly" | "xlValidateWholeNumber" | "xlValidateDecimal" |
 * "xlValidateList" | "xlValidateDate" | "xlValidateTime" | "xlValidateTextLength" |
 * "xlValidateCustom")} ValidationType
 */

/**
 * The validation alert style.
 * @typedef {("xlValidAlertStop" | "xlValidAlertWarning" | "xlValidAlertInformation")} ValidationAlertStyle
 */

/**
 * The validation operator.
 * @typedef {("xlBetween" | "xlNotBetween" | "xlEqual" | "xlNotEqual" |
 * "xlGreater" | "xlLess" | "xlGreaterEqual" | "xlLessEqual")} ValidationOperator
 */

/**
 * Condition value types for color scale criteria.
 * @typedef {("xlConditionValueAutomaticMax" | "xlConditionValueAutomaticMin" |
 * "xlConditionValueHighestValue" | "xlConditionValueLowestValue" |
 * "xlConditionValueNone" | "xlConditionValueNumber" | "xlConditionValuePercent" |
 * "xlConditionValuePercentile" | "xlConditionValueFormula")} XlConditionValueTypes
 */

/**
 * Icon set types for conditional formatting.
 * @typedef {("xl3Arrows" | "xl3ArrowsGray" | "xl3Flags" | "xl3TrafficLights1" | "xl3TrafficLights2" |
 * "xl3Signs" | "xl3Symbols" | "xl3Symbols2" | "xl4Arrows" | "xl4ArrowsGray" | "xl4RedToBlack" |
 * "xl4CRV" | "xl4TrafficLights" | "xl5Arrows" | "xl5ArrowsGray" | "xl5CRV" | "xl5Quarters" |
 * "xl3Stars" | "xl3Triangles" | "xl5Boxes")} XlIconSet
 */

/**
 * Calculation scope for pivot table conditions.
 * @typedef {("xlAllValues" | "xlColItems" | "xlRowItems")} XlCalcFor
 */

/**
 * The XlTopBottom enumeration constants.
 * @typedef {("xlTop10Top" | "xlTop10Bottom")} XlTopBottom
 */

/**
 * The XlDuplicateValues enumeration constants.
 * @typedef {("xlDuplicate" | "xlUnique")} XlDuplicateValues
 */

/**
 * Class representing data validation.
 * @constructor
 * @property {ValidationType} Type - Returns or sets the validation type.
 * @property {ValidationAlertStyle} AlertStyle - Returns or sets the validation alert style.
 * @property {boolean} IgnoreBlank - Returns or sets a Boolean value that specifies whether blank values are permitted by the range data validation.
 * @property {boolean} InCellDropdown - Returns or sets a Boolean value indicating whether data validation displays a drop-down list that contains acceptable values.
 * @property {boolean} ShowInput - Returns or sets a Boolean value indicating whether the data validation input message will be displayed whenever the user selects a cell in the data validation range.
 * @property {boolean} ShowError - Returns or sets a Boolean value indicating whether the data validation error message will be displayed whenever the user enters invalid data.
 * @property {string} InputTitle - Returns or sets the title of the data-validation input dialog box.
 * @property {string} InputMessage - Returns or sets the data validation input message.
 * @property {string} ErrorTitle - Returns or sets the title of the data-validation error dialog box.
 * @property {string} ErrorMessage - Returns or sets the data validation error message.
 * @property {string} Formula1 - Returns or sets the value or expression associated with the conditional format or data validation.
 * @property {string} Formula2 - Returns or sets the value or expression associated with the second part of a conditional format or data validation.
 * @property {ValidationOperator} Operator - Returns or sets the data validation operator.
 * @property {ApiRange} Parent - Returns the parent range object.
 * @property {string} Value - Returns or sets the validation value.
 */
function ApiValidation(validation, range) {}

/**
 * Adds data validation to the specified range.
 * @memberof ApiValidation
 * @param {ValidationType} Type - The validation type.
 * @param {ValidationAlertStyle} [AlertStyle] - The validation alert style.
 * @param {ValidationOperator} [Operator] - The data validation operator.
 * @param {string | number | ApiRange} [Formula1] - The first formula in the data validation.
 * @param {string | number | ApiRange} [Formula2] - The second formula in the data validation.
 * @returns {ApiValidation | null}
 */
ApiValidation.prototype.Add = function(Type, AlertStyle, Operator, Formula1, Formula2) { return new ApiValidation(); };

/**
 * Deletes the object.
 * @memberof ApiValidation
 */
ApiValidation.prototype.Delete = function() {};

/**
 * Modifies data validation for a range.
 * @memberof ApiValidation
 * @param {ValidationType} [Type] - The validation type.
 * @param {ValidationAlertStyle} [AlertStyle] - The validation alert style.
 * @param {ValidationOperator} [Operator] - The data validation operator.
 * @param {string | number | ApiRange} [Formula1] - The first formula in the data validation.
 * @param {string | number | ApiRange} [Formula2] - The second formula in the data validation.
 * @returns {ApiValidation | null}
 */
ApiValidation.prototype.Modify = function(Type, AlertStyle, Operator, Formula1, Formula2) { return new ApiValidation(); };

/**
 * Returns the validation type.
 * @memberof ApiValidation
 * @returns {ValidationType}
 */
ApiValidation.prototype.GetType = function() { return new ValidationType(); };

/**
 * Sets the validation type.
 * @memberof ApiValidation
 * @param {ValidationType} Type - The validation type.
 */
ApiValidation.prototype.SetType = function(Type) {};

/**
 * Returns the validation alert style.
 * @memberof ApiValidation
 * @returns {ValidationAlertStyle}
 */
ApiValidation.prototype.GetAlertStyle = function() { return new ValidationAlertStyle(); };

/**
 * Sets the validation alert style.
 * @memberof ApiValidation
 * @param {ValidationAlertStyle} AlertStyle - The validation alert style.
 */
ApiValidation.prototype.SetAlertStyle = function(AlertStyle) {};

/**
 * Returns whether blank values are permitted by the range data validation.
 * @memberof ApiValidation
 * @returns {boolean}
 */
ApiValidation.prototype.GetIgnoreBlank = function() { return true; };

/**
 * Sets whether blank values are permitted by the range data validation.
 * @memberof ApiValidation
 * @param {boolean} IgnoreBlank - Specifies whether blank values are permitted.
 */
ApiValidation.prototype.SetIgnoreBlank = function(IgnoreBlank) {};

/**
 * Returns whether data validation displays a drop-down list that contains acceptable values.
 * @memberof ApiValidation
 * @returns {boolean}
 */
ApiValidation.prototype.GetInCellDropdown = function() { return true; };

/**
 * Sets whether data validation displays a drop-down list that contains acceptable values.
 * @memberof ApiValidation
 * @param {boolean} InCellDropdown - Specifies whether to display a drop-down list.
 */
ApiValidation.prototype.SetInCellDropdown = function(InCellDropdown) {};

/**
 * Returns whether the data validation input message will be displayed.
 * @memberof ApiValidation
 * @returns {boolean}
 */
ApiValidation.prototype.GetShowInput = function() { return true; };

/**
 * Sets whether the data validation input message will be displayed.
 * @memberof ApiValidation
 * @param {boolean} ShowInput - Specifies whether to show input message.
 */
ApiValidation.prototype.SetShowInput = function(ShowInput) {};

/**
 * Returns whether the data validation error message will be displayed.
 * @memberof ApiValidation
 * @returns {boolean}
 */
ApiValidation.prototype.GetShowError = function() { return true; };

/**
 * Sets whether the data validation error message will be displayed.
 * @memberof ApiValidation
 * @param {boolean} ShowError - Specifies whether to show error message.
 */
ApiValidation.prototype.SetShowError = function(ShowError) {};

/**
 * Returns the title of the data-validation input dialog box.
 * @memberof ApiValidation
 * @returns {string}
 */
ApiValidation.prototype.GetInputTitle = function() { return ""; };

/**
 * Sets the title of the data-validation input dialog box.
 * @memberof ApiValidation
 * @param {string} InputTitle - The input dialog title.
 */
ApiValidation.prototype.SetInputTitle = function(InputTitle) {};

/**
 * Returns the data validation input message.
 * @memberof ApiValidation
 * @returns {string}
 */
ApiValidation.prototype.GetInputMessage = function() { return ""; };

/**
 * Sets the data validation input message.
 * @memberof ApiValidation
 * @param {string} InputMessage - The input message.
 */
ApiValidation.prototype.SetInputMessage = function(InputMessage) {};

/**
 * Returns the title of the data-validation error dialog box.
 * @memberof ApiValidation
 * @returns {string}
 */
ApiValidation.prototype.GetErrorTitle = function() { return ""; };

/**
 * Sets the title of the data-validation error dialog box.
 * @memberof ApiValidation
 * @param {string} ErrorTitle - The error dialog title.
 */
ApiValidation.prototype.SetErrorTitle = function(ErrorTitle) {};

/**
 * Returns the data validation error message.
 * @memberof ApiValidation
 * @returns {string}
 */
ApiValidation.prototype.GetErrorMessage = function() { return ""; };

/**
 * Sets the data validation error message.
 * @memberof ApiValidation
 * @param {string} ErrorMessage - The error message.
 */
ApiValidation.prototype.SetErrorMessage = function(ErrorMessage) {};

/**
 * Returns the first formula in the data validation.
 * @memberof ApiValidation
 * @returns {string}
 */
ApiValidation.prototype.GetFormula1 = function() { return ""; };

/**
 * Sets the first formula in the data validation.
 * @memberof ApiValidation
 * @param {string} Formula1 - The first formula.
 */
ApiValidation.prototype.SetFormula1 = function(Formula1) {};

/**
 * Returns the second formula in the data validation.
 * @memberof ApiValidation
 * @returns {string}
 */
ApiValidation.prototype.GetFormula2 = function() { return ""; };

/**
 * Sets the second formula in the data validation.
 * @memberof ApiValidation
 * @param {string} Formula2 - The second formula.
 */
ApiValidation.prototype.SetFormula2 = function(Formula2) {};

/**
 * Returns the data validation operator.
 * @memberof ApiValidation
 * @returns {ValidationOperator}
 */
ApiValidation.prototype.GetOperator = function() { return new ValidationOperator(); };

/**
 * Sets the data validation operator.
 * @memberof ApiValidation
 * @param {ValidationOperator} Operator - The validation operator.
 */
ApiValidation.prototype.SetOperator = function(Operator) {};

/**
 * Returns the parent range object.
 * @memberof ApiValidation
 * @returns {ApiRange}
 */
ApiValidation.prototype.GetParent = function() { return new ApiRange(); };

/**
 * Returns the parent range object.
 * @memberof ApiValidation
 * @returns {ApiRange}
 */
ApiValidation.prototype.Type = ApiValidation.prototype.GetParent ();

/**
 * Conditional formatting type.
 * @typedef {("xlCellValue" | "xlExpression" | "xlTop10" | "xlAboveAverageCondition" |
 * "xlUniqueValues" | "xlTextString" | "xlBlanksCondition" | "xlTimePeriod" | "xlErrorsCondition" |
 * "xlNoErrorsCondition" | "xlColorScale" | "xlDatabar" | "xlIconSets")} XlFormatConditionType
 */

/**
 * Format condition operator.
 * @typedef {("xlBetween" | "xlNotBetween" | "xlEqual" | "xlNotEqual" |
 * "xlGreater" | "xlLess" | "xlGreaterEqual" | "xlLessEqual" | "xlBeginsWith" |
 * "xlEndsWith" | "xlContains" | "xlNotContains")} XlFormatConditionOperator
 */

/**
 * Time period for conditional formatting.
 * @typedef {("xlToday" | "xlYesterday" | "xlTomorrow" | "xlLast7Days" | "xlLastWeek" |
 * "xlThisWeek" | "xlNextWeek" | "xlLastMonth" | "xlThisMonth" | "xlNextMonth")} XlTimePeriods
 */

/**
 * Contains operator for text-based conditional formatting.
 * @typedef {("xlContains" | "xlDoesNotContain" | "xlBeginsWith" | "xlEndsWith")} XlContainsOperator
 */

/**
 * Specifies the scope for pivot table conditional formatting conditions.
 * @typedef {("xlFieldsScope" | "xlSelectionScope" | "xlDataFieldScope")} XlPivotConditionScope
 */

/**
 * The data bar axis position.
 * @typedef {("xlDataBarAxisAutomatic" | "xlDataBarAxisMidpoint" | "xlDataBarAxisNone")} XlDataBarAxisPosition
 */

/**
 * The reading order for data bars.
 * @typedef {("xlLTR" | "xlRTL" | "xlContext")} XlReadingOrder
 */

/**
 * Class representing a collection of format conditions.
 * @constructor
 */
function ApiFormatConditions(range) {}

/**
 * Adds a new format condition to the collection.
 * @memberof ApiFormatConditions
 * @param {XlFormatConditionType} Type - The format condition type.
 * @param {XlFormatConditionOperator} [Operator] - The format condition operator.
 * @param {string | number | ApiRange} [Formula1] - The first formula.
 * @param {string | number | ApiRange} [Formula2] - The second formula.
 * @returns {ApiFormatCondition | null}
 */
ApiFormatConditions.prototype.Add = function(Type, Operator, Formula1, Formula2) { return new ApiFormatCondition(); };

/**
 * Adds a new above average conditional formatting rule to the collection.
 * @memberof ApiFormatConditions
 * @returns {ApiAboveAverage | null}
 */
ApiFormatConditions.prototype.AddAboveAverage = function() { return new ApiAboveAverage(); };

/**
 * Adds a new color scale conditional formatting rule to the collection.
 * @memberof ApiFormatConditions
 * @param {number} [ColorScaleType=3] - The type of color scale (2 for two-color scale, 3 for three-color scale).
 * @returns {ApiColorScale | null}
 */
ApiFormatConditions.prototype.AddColorScale = function(ColorScaleType) { return new ApiColorScale(); };

/**
 * Adds a new data bar conditional formatting rule to the collection.
 * @memberof ApiFormatConditions
 * @returns {ApiDatabar | null}
 */
ApiFormatConditions.prototype.AddDatabar = function() { return new ApiDatabar(); };

/**
 * Adds a new icon set conditional formatting rule to the collection.
 * @memberof ApiFormatConditions
 * @returns {ApiIconSetCondition | null}
 */
ApiFormatConditions.prototype.AddIconSetCondition = function() { return new ApiIconSetCondition(); };

/**
 * Adds a new top 10 conditional formatting rule to the collection.
 * @memberof ApiFormatConditions
 * @returns {ApiTop10 | null}
 */
ApiFormatConditions.prototype.AddTop10 = function() { return new ApiTop10(); };

/**
 * Adds a new unique values conditional formatting rule to the collection.
 * @memberof ApiFormatConditions
 * @returns {ApiUniqueValues | null}
 */
ApiFormatConditions.prototype.AddUniqueValues = function() { return new ApiUniqueValues(); };

/**
 * Deletes all format conditions from the collection.
 * @memberof ApiFormatConditions
 */
ApiFormatConditions.prototype.Delete = function() {};

/**
 * Returns the count of format conditions.
 * @memberof ApiFormatConditions
 * @returns {number}
 */
ApiFormatConditions.prototype.GetCount = function() { return 0; };

/**
 * Returns a format condition by index.
 * @memberof ApiFormatConditions
 * @param {number} index - The index of the format condition (1-based).
 * @returns {ApiFormatCondition | null}
 */
ApiFormatConditions.prototype.GetItem = function(index) { return new ApiFormatCondition(); };

/**
 * Returns a format condition by index.
 * @memberof ApiFormatConditions
 * @param {number} index - The index of the format condition (1-based).
 * @returns {ApiFormatCondition | null}
 */
ApiFormatConditions.prototype.Count = ApiFormatConditions.prototype.GetItem ();

/**
 * Returns the parent range object.
 * @memberof ApiFormatConditions
 * @returns {ApiRange}
 */
ApiFormatConditions.prototype.GetParent = function() { return new ApiRange(); };

/**
 * Returns the parent range object.
 * @memberof ApiFormatConditions
 * @returns {ApiRange}
 */
ApiFormatConditions.prototype.Parent = ApiFormatConditions.prototype.GetParent ();

/**
 * Class representing a single format condition.
 * @constructor
 * @property {XlFormatConditionType} Type - Returns or sets the format condition type.
 * @property {XlFormatConditionOperator} Operator - Returns or sets the format condition operator.
 * @property {string} Formula1 - Returns or sets the first formula.
 * @property {string} Formula2 - Returns or sets the second formula.
 * @property {XlTimePeriods} DateOperator - Returns or sets the date operator for time period conditions.
 * @property {string} Text - Returns or sets the text for text-based conditions.
 * @property {number} Rank - Returns or sets the rank for top/bottom conditions.
 * @property {boolean} PercentRank - Returns or sets whether rank is percentage-based.
 * @property {boolean} AboveBelow - Returns or sets above/below for average conditions.
 * @property {number} StdDev - Returns or sets standard deviations for average conditions.
 * @property {number} Priority - Returns or sets the priority of the condition.
 * @property {boolean} StopIfTrue - Returns or sets whether to stop if this condition is true.
 * @property {ApiRange} AppliesTo - Returns the range the condition applies to.
 */
function ApiFormatCondition(rule, range, _parent) {}

/**
 * Deletes the format condition.
 * @memberof ApiFormatCondition
 */
ApiFormatCondition.prototype.Delete = function() {};

/**
 * Modifies the format condition.
 * @memberof ApiFormatCondition
 * @param {XlFormatConditionType} [Type] - The format condition type.
 * @param {XlFormatConditionOperator} [Operator] - The format condition operator.
 * @param {string | number | ApiRange} [Formula1] - The first formula.
 * @param {string | number | ApiRange} [Formula2] - The second formula.
 * @returns {ApiFormatCondition | null}
 */
ApiFormatCondition.prototype.Modify = function(Type, Operator, Formula1, Formula2) { return new ApiFormatCondition(); };

/**
 * Sets the cell range to which this formatting rule applies.
 * @memberof ApiFormatCondition
 * @param {ApiRange} Range - The range to which this formatting rule will be applied.
 */
ApiFormatCondition.prototype.ModifyAppliesToRange = function(Range) {};

/**
 * Returns the range the condition applies to.
 * @memberof ApiFormatCondition
 * @returns {ApiRange | null}
 */
ApiFormatCondition.prototype.GetAppliesTo = function() { return new ApiRange(); };

/**
 * Returns the range the condition applies to.
 * @memberof ApiFormatCondition
 * @returns {ApiRange | null}
 */
ApiFormatCondition.prototype.AppliesTo = ApiFormatCondition.prototype.GetAppliesTo ();

/**
 * Returns the font applied by the format condition.
 * @memberof ApiFormatCondition
 * @returns {ApiFont | null}
 */
ApiFormatCondition.prototype.GetFont = function() { return new ApiFont(); };

/**
 * Returns the font applied by the format condition.
 * @memberof ApiFormatCondition
 * @returns {ApiFont | null}
 */
ApiFormatCondition.prototype.Font = ApiFormatCondition.prototype.GetFont ();

/**
 * Returns the format condition type.
 * @memberof ApiFormatCondition
 * @returns {XlFormatConditionType}
 */
ApiFormatCondition.prototype.GetType = function() { return new XlFormatConditionType(); };

/**
 * Returns the first formula.
 * @memberof ApiFormatCondition
 * @returns {string}
 */
ApiFormatCondition.prototype.GetFormula1 = function() { return ""; };

/**
//  * Sets the first formula.
//  * @memberof ApiFormatCondition
//  * @param {string} Formula1 - The first formula.
//  */
// ApiFormatCondition.prototype.SetFormula1 = function(Formula1) {};

/**
//  * Sets the first formula.
//  * @memberof ApiFormatCondition
//  * @param {string} Formula1 - The first formula.
//  */
// ApiFormatCondition.prototype.Formula1 = // ApiFormatCondition.prototype.SetFormula1 ();

/**
 * Returns the second formula.
 * @memberof ApiFormatCondition
 * @returns {string}
 */
ApiFormatCondition.prototype.GetFormula2 = function() { return ""; };

/**
//  * Sets the second formula.
//  * @memberof ApiFormatCondition
//  * @param {string} Formula2 - The second formula.
//  */
// ApiFormatCondition.prototype.SetFormula2 = function(Formula2) {};

/**
//  * Sets the second formula.
//  * @memberof ApiFormatCondition
//  * @param {string} Formula2 - The second formula.
//  */
// ApiFormatCondition.prototype.Formula2 = // ApiFormatCondition.prototype.SetFormula2 ();

/**
 * Sets the number format applied to a cell if the conditional formatting rule evaluates to True.
 * @memberof ApiFormatCondition
 * @param {string} NumberFormat - The number format code (e.g., "General", "#,##0.00", etc.)
 */
ApiFormatCondition.prototype.SetNumberFormat = function(NumberFormat) {};

/**
 * Returns the number format applied to a cell if the conditional formatting rule evaluates to True.
 * @memberof ApiFormatCondition
 * @returns {string}
 */
ApiFormatCondition.prototype.GetNumberFormat = function() { return ""; };

/**
 * Returns the number format applied to a cell if the conditional formatting rule evaluates to True.
 * @memberof ApiFormatCondition
 * @returns {string}
 */
ApiFormatCondition.prototype.NumberFormat = ApiFormatCondition.prototype.GetNumberFormat ();

/**
//  * Sets the format condition operator.
//  * @memberof ApiFormatCondition
//  * @param {XlFormatConditionOperator} Operator - The format condition operator.
//  */
// ApiFormatCondition.prototype.SetOperator = function(Operator) {};

/**
 * Returns the format condition operator.
 * @memberof ApiFormatCondition
 * @returns {XlFormatConditionOperator}
 */
ApiFormatCondition.prototype.GetOperator = function() { return new XlFormatConditionOperator(); };

/**
 * Returns the format condition operator.
 * @memberof ApiFormatCondition
 * @returns {XlFormatConditionOperator}
 */
ApiFormatCondition.prototype.Operator = ApiFormatCondition.prototype.GetOperator ();

/**
 * Returns the parent range object.
 * @memberof ApiFormatCondition
 * @returns {ApiRange}
 */
ApiFormatCondition.prototype.GetParent = function() { return new ApiRange(); };

/**
 * Returns the parent range object.
 * @memberof ApiFormatCondition
 * @returns {ApiRange}
 */
ApiFormatCondition.prototype.Parent = ApiFormatCondition.prototype.GetParent ();

/**
 * Returns the format condition type.
 * @memberof ApiFormatCondition
 * @returns {XlFormatConditionType}
 */
ApiFormatCondition.prototype.GetType = function() { return new XlFormatConditionType(); };

/**
 * Returns the format condition type.
 * @memberof ApiFormatCondition
 * @returns {XlFormatConditionType}
 */
ApiFormatCondition.prototype.Type = ApiFormatCondition.prototype.GetType ();

/**
 * Returns the pivot table condition object.
 * @memberof ApiFormatCondition
 * @returns {PTCondition | null}
 */
ApiFormatCondition.prototype.GetPTCondition = function() { return new PTCondition(); };

/**
 * Returns the pivot table condition object.
 * @memberof ApiFormatCondition
 * @returns {PTCondition | null}
 */
ApiFormatCondition.prototype.PTCondition = ApiFormatCondition.prototype.GetPTCondition ();

/**
 * Returns the priority value of the conditional formatting rule.
 * @memberof ApiFormatCondition
 * @returns {number}
 */
ApiFormatCondition.prototype.GetPriority = function() { return 0; };

/**
 * Sets the priority value of the conditional formatting rule.
 * @memberof ApiFormatCondition
 * @param {number} Priority - The priority value (1-based).
 */
ApiFormatCondition.prototype.SetPriority = function(Priority) {};

/**
 * Sets the priority value of the conditional formatting rule.
 * @memberof ApiFormatCondition
 * @param {number} Priority - The priority value (1-based).
 */
ApiFormatCondition.prototype.Priority = ApiFormatCondition.prototype.SetPriority ();

/**
 * Returns the scope type of the conditional formatting rule.
 * @memberof ApiFormatCondition
 * @returns {XlPivotConditionScope} - Returns "xlSelectionScope" for normal ranges, "xlDataFieldScope" for entire worksheet, "xlFieldsScope" for pivot tables
 */
ApiFormatCondition.prototype.GetScopeType = function() { return new XlPivotConditionScope(); };

/**
 * Sets the scope type of the conditional formatting rule.
 * @memberof ApiFormatCondition
 * @param {XlPivotConditionScope} ScopeType - The scope type: "xlSelectionScope", "xlDataFieldScope", or "xlFieldsScope"
 */
ApiFormatCondition.prototype.SetScopeType = function(ScopeType) {};

/**
 * Sets the scope type of the conditional formatting rule.
 * @memberof ApiFormatCondition
 * @param {XlPivotConditionScope} ScopeType - The scope type: "xlSelectionScope", "xlDataFieldScope", or "xlFieldsScope"
 */
ApiFormatCondition.prototype.ScopeType = ApiFormatCondition.prototype.SetScopeType ();

/**
 * Returns whether Excel will stop evaluating additional formatting rules if this rule evaluates to True.
 * @memberof ApiFormatCondition
 * @returns {boolean}
 */
ApiFormatCondition.prototype.GetStopIfTrue = function() { return true; };

/**
 * Sets whether Excel will stop evaluating additional formatting rules if this rule evaluates to True.
 * @memberof ApiFormatCondition
 * @param {boolean} StopIfTrue - True to stop evaluating additional rules.
 */
ApiFormatCondition.prototype.SetStopIfTrue = function(StopIfTrue) {};

/**
 * Sets whether Excel will stop evaluating additional formatting rules if this rule evaluates to True.
 * @memberof ApiFormatCondition
 * @param {boolean} StopIfTrue - True to stop evaluating additional rules.
 */
ApiFormatCondition.prototype.StopIfTrue = ApiFormatCondition.prototype.SetStopIfTrue ();

/**
 * Returns the text value used in text-based conditional formatting rules.
 * @memberof ApiFormatCondition
 * @returns {string}
 */
ApiFormatCondition.prototype.GetText = function() { return ""; };

/**
 * Sets the text value used in text-based conditional formatting rules.
 * @memberof ApiFormatCondition
 * @param {string} Text - The text value to compare against.
 */
ApiFormatCondition.prototype.SetText = function(Text) {};

/**
 * Sets the text value used in text-based conditional formatting rules.
 * @memberof ApiFormatCondition
 * @param {string} Text - The text value to compare against.
 */
ApiFormatCondition.prototype.Text = ApiFormatCondition.prototype.SetText ();

/**
 * Returns the text operator for text-based conditional formatting rules.
 * @memberof ApiFormatCondition
 * @returns {XlContainsOperator | null}
 */
ApiFormatCondition.prototype.GetTextOperator = function() { return new XlContainsOperator(); };

/**
 * Sets the text operator for text-based conditional formatting rules.
 * @memberof ApiFormatCondition
 * @param {XlContainsOperator} TextOperator - The text operator: "xlContains", "xlDoesNotContain", "xlBeginsWith", "xlEndsWith"
 */
ApiFormatCondition.prototype.SetTextOperator = function(TextOperator) {};

/**
 * Sets the text operator for text-based conditional formatting rules.
 * @memberof ApiFormatCondition
 * @param {XlContainsOperator} TextOperator - The text operator: "xlContains", "xlDoesNotContain", "xlBeginsWith", "xlEndsWith"
 */
ApiFormatCondition.prototype.TextOperator = ApiFormatCondition.prototype.SetTextOperator ();

/**
 * Returns the date operator for time period conditions.
 * @memberof ApiFormatCondition
 * @returns {XlTimePeriods | null}
 */
ApiFormatCondition.prototype.GetDateOperator = function() { return new XlTimePeriods(); };

/**
 * Sets the date operator for time period conditions.
 * @memberof ApiFormatCondition
 * @param {XlTimePeriods} DateOperator - The date operator for time period conditions.
 */
ApiFormatCondition.prototype.SetDateOperator = function(DateOperator) {};

/**
 * Sets the date operator for time period conditions.
 * @memberof ApiFormatCondition
 * @param {XlTimePeriods} DateOperator - The date operator for time period conditions.
 */
ApiFormatCondition.prototype.DateOperator = ApiFormatCondition.prototype.SetDateOperator ();

/**
 * Sets borders for the format condition.
 * @memberof ApiFormatCondition
 * @param {BordersIndex} bordersIndex - Specifies the cell border position.
 * @param {LineStyle} lineStyle - Specifies the line style used to form the cell border.
 * @param {ApiColor} oColor - The color object which specifies the color to be set to the cell border.
 */
ApiFormatCondition.prototype.SetBorders = function(bordersIndex, lineStyle, oColor) {};

/**
 * Sets the background color to the format condition with the previously created color object.
 * Sets 'No Fill' when previously created color object is null.
 * @memberof ApiFormatCondition
 * @param {ApiColor} oColor - The color object which specifies the color to be set to the background in the format condition.
 */
ApiFormatCondition.prototype.SetFillColor = function(oColor) {};

/**
 * Returns the background color for the format condition. Returns 'No Fill' when the color of the background in the format condition is null.
 * @memberof ApiFormatCondition
 * @returns {ApiColor|'No Fill'} - return 'No Fill' when the color to the background in the format condition is null.
 */
ApiFormatCondition.prototype.GetFillColor = function() { return new ApiColor(); };

/**
 * Returns the background color for the format condition. Returns 'No Fill' when the color of the background in the format condition is null.
 * @memberof ApiFormatCondition
 * @returns {ApiColor|'No Fill'} - return 'No Fill' when the color to the background in the format condition is null.
 */
ApiFormatCondition.prototype.FillColor = ApiFormatCondition.prototype.GetFillColor ();

/**
 * Class representing an above average conditional formatting rule.
 * @constructor
 * @extends ApiFormatCondition
 */
function ApiAboveAverage(rule, range, _parent) {}
ApiAboveAverage.prototype = Object.create(ApiFormatCondition.prototype);
ApiAboveAverage.prototype.constructor = ApiAboveAverage;

/**
 * Returns whether the rule is looking for above or below average values.
 * @memberof ApiAboveAverage
 * @returns {boolean} True if looking for above average values, false for below average.
 * @since 9.1.0
 */
ApiAboveAverage.prototype.GetAboveBelow = function() { return true; };

/**
 * Sets whether the rule is looking for above or below average values.
 * @memberof ApiAboveAverage
 * @param {boolean} aboveBelow - True to look for above average values, false for below average.
 * @since 9.1.0
 */
ApiAboveAverage.prototype.SetAboveBelow = function(aboveBelow) {};

/**
 * Sets whether the rule is looking for above or below average values.
 * @memberof ApiAboveAverage
 * @param {boolean} aboveBelow - True to look for above average values, false for below average.
 * @since 9.1.0
 */
ApiAboveAverage.prototype.AboveBelow = ApiAboveAverage.prototype.SetAboveBelow ();

/**
 * Returns the calculation scope for the above average condition in pivot tables.
 * @memberof ApiAboveAverage
 * @returns {number}
 * @since 9.1.0
 */
ApiAboveAverage.prototype.GetCalcFor = function() { return 0; };

/**
 * Sets the calculation scope for the above average condition in pivot tables.
 * @memberof ApiAboveAverage
 * @param {number} calcFor - The calculation scope (0 = xlAllValues, 1 = xlColItems, 2 = xlRowItems)
 * @since 9.1.0
 */
ApiAboveAverage.prototype.SetCalcFor = function(calcFor) {};

/**
 * Sets the calculation scope for the above average condition in pivot tables.
 * @memberof ApiAboveAverage
 * @param {number} calcFor - The calculation scope (0 = xlAllValues, 1 = xlColItems, 2 = xlRowItems)
 * @since 9.1.0
 */
ApiAboveAverage.prototype.CalcFor = ApiAboveAverage.prototype.SetCalcFor ();

/**
 * Returns the number of standard deviations from the average.
 * @memberof ApiAboveAverage
 * @returns {number}
 * @since 9.1.0
 */
ApiAboveAverage.prototype.GetNumStdDev = function() { return 0; };

/**
 * Sets the number of standard deviations from the average.
 * @memberof ApiAboveAverage
 * @param {number} numStdDev - The number of standard deviations (0 for simple average, positive numbers for deviations)
 * @since 9.1.0
 */
ApiAboveAverage.prototype.SetNumStdDev = function(numStdDev) {};

/**
 * Sets the number of standard deviations from the average.
 * @memberof ApiAboveAverage
 * @param {number} numStdDev - The number of standard deviations (0 for simple average, positive numbers for deviations)
 * @since 9.1.0
 */
ApiAboveAverage.prototype.NumStdDev = ApiAboveAverage.prototype.SetNumStdDev ();

/**
 * Returns the type of the above average conditional formatting rule.
 * @memberof ApiAboveAverage
 * @returns {XlFormatConditionType}
 * @since 9.1.0
 */
ApiAboveAverage.prototype.GetType = function() { return new XlFormatConditionType(); };

/**
 * Returns the type of the above average conditional formatting rule.
 * @memberof ApiAboveAverage
 * @returns {XlFormatConditionType}
 * @since 9.1.0
 */
ApiAboveAverage.prototype.Type = ApiAboveAverage.prototype.GetType ();

/**
 * Deletes the above average conditional formatting rule.
 * @memberof ApiAboveAverage
 * @since 9.1.0
 */
ApiAboveAverage.prototype.Delete = ApiFormatCondition.prototype.Delete;{};

/**
 * Modifies the range to which this formatting rule applies.
 * @memberof ApiAboveAverage
 * @param {ApiRange} Range - A Range object representing the new range to which the formatting rule will be applied.
 * @since 9.1.0
 */
ApiAboveAverage.prototype.ModifyAppliesToRange = ApiFormatCondition.prototype.ModifyAppliesToRange;{};

/**
 * Sets the priority value for this conditional formatting rule to "1" so that it will be evaluated before all other rules on the worksheet.
 * @memberof ApiAboveAverage
 * @since 9.1.0
 */
ApiAboveAverage.prototype.SetFirstPriority = ApiFormatCondition.prototype.SetFirstPriority;{};

/**
 * Sets the evaluation order for this conditional formatting rule so it is evaluated after all other rules on the worksheet.
 * @memberof ApiAboveAverage
 * @since 9.1.0
 */
ApiAboveAverage.prototype.SetLastPriority = ApiFormatCondition.prototype.SetLastPriority;{};

/**
 * Returns the range to which the conditional formatting rule applies.
 * @memberof ApiAboveAverage
 * @returns {ApiRange}
 * @since 9.1.0
 */
ApiAboveAverage.prototype.GetAppliesTo = ApiFormatCondition.prototype.GetAppliesTo;{ return new ApiRange(); };

/**
//  * Returns the Borders collection that represents the borders of a style or a range of cells (including a range defined as part of a conditional format).
//  * @memberof ApiAboveAverage
//  * @returns {ApiBorders}
//  * @since 9.1.0
//  */
// ApiAboveAverage.prototype.GetBorders = ApiFormatCondition.prototype.GetBorders;{ return new ApiBorders(); };

/**
 * Returns the Font object that represents the font of the specified object.
 * @memberof ApiAboveAverage
 * @returns {ApiFont}
 * @since 9.1.0
 */
ApiAboveAverage.prototype.GetFont = ApiFormatCondition.prototype.GetFont;{ return new ApiFont(); };

/**
 * Returns the Interior object that represents the interior of the specified object.
 * @memberof ApiAboveAverage
 * @returns {ApiInterior}
 * @since 9.1.0
 */
ApiAboveAverage.prototype.GetInterior = ApiFormatCondition.prototype.GetInterior;{ return new ApiInterior(); };

/**
 * Returns the number format applied to a cell if the conditional formatting rule evaluates to True.
 * @memberof ApiAboveAverage
 * @returns {string}
 * @since 9.1.0
 */
ApiAboveAverage.prototype.GetNumberFormat = ApiFormatCondition.prototype.GetNumberFormat;{ return ""; };

/**
 * Sets the number format applied to a cell if the conditional formatting rule evaluates to True.
 * @memberof ApiAboveAverage
 * @param {string} NumberFormat - The number format code.
 * @since 9.1.0
 */
ApiAboveAverage.prototype.SetNumberFormat = ApiFormatCondition.prototype.SetNumberFormat;{};

/**
 * Returns the background color for the format condition. Returns 'No Fill' when the color of the background in the format condition is null.
 * @memberof ApiAboveAverage
 * @returns {ApiColor|'No Fill'}
 * @since 9.1.0
 */
ApiAboveAverage.prototype.GetFillColor = ApiFormatCondition.prototype.GetFillColor;{ return new ApiColor(); };

/**
 * Sets the background color to the format condition with the previously created color object.
 * Sets 'No Fill' when previously created color object is null.
 * @memberof ApiAboveAverage
 * @param {ApiColor} oColor - The color object which specifies the color to be set to the background in the format condition.
 * @since 9.1.0
 */
ApiAboveAverage.prototype.SetFillColor = ApiFormatCondition.prototype.SetFillColor;{};

/**
 * Returns the parent object for the specified object.
 * @memberof ApiAboveAverage
 * @returns {ApiRange}
 * @since 9.1.0
 */
ApiAboveAverage.prototype.GetParent = ApiFormatCondition.prototype.GetParent;{ return new ApiRange(); };

/**
 * Returns the priority value of the conditional formatting rule.
 * @memberof ApiAboveAverage
 * @returns {number}
 * @since 9.1.0
 */
ApiAboveAverage.prototype.GetPriority = ApiFormatCondition.prototype.GetPriority;{ return 0; };

/**
 * Sets the priority value of the conditional formatting rule.
 * @memberof ApiAboveAverage
 * @param {number} Priority - The priority value (1-based).
 * @since 9.1.0
 */
ApiAboveAverage.prototype.SetPriority = ApiFormatCondition.prototype.SetPriority;{};

/**
 * Returns the pivot table condition object.
 * @memberof ApiAboveAverage
 * @returns {PTCondition | null}
 * @since 9.1.0
 */
ApiAboveAverage.prototype.GetPTCondition = ApiFormatCondition.prototype.GetPTCondition;{ return new PTCondition(); };

/**
 * Returns the scope type of the conditional formatting rule.
 * @memberof ApiAboveAverage
 * @returns {XlPivotConditionScope}
 * @since 9.1.0
 */
ApiAboveAverage.prototype.GetScopeType = ApiFormatCondition.prototype.GetScopeType;{ return new XlPivotConditionScope(); };

/**
 * Sets the scope type of the conditional formatting rule.
 * @memberof ApiAboveAverage
 * @param {XlPivotConditionScope} ScopeType - The scope type.
 * @since 9.1.0
 */
ApiAboveAverage.prototype.SetScopeType = ApiFormatCondition.prototype.SetScopeType;{};

/**
 * Returns whether Excel will stop evaluating additional formatting rules if this rule evaluates to True.
 * @memberof ApiAboveAverage
 * @returns {boolean}
 * @since 9.1.0
 */
ApiAboveAverage.prototype.GetStopIfTrue = ApiFormatCondition.prototype.GetStopIfTrue;{ return true; };

/**
 * Sets whether Excel will stop evaluating additional formatting rules if this rule evaluates to True.
 * @memberof ApiAboveAverage
 * @param {boolean} StopIfTrue - True to stop evaluating additional rules.
 * @since 9.1.0
 */
ApiAboveAverage.prototype.SetStopIfTrue = ApiFormatCondition.prototype.SetStopIfTrue;{};

/**
 * Class representing a color scale conditional formatting rule.
 * @constructor
 * @extends ApiFormatCondition
 */
function ApiColorScale(rule, range, _parent) {}
ApiColorScale.prototype = Object.create(ApiFormatCondition.prototype);
ApiColorScale.prototype.constructor = ApiColorScale;

/**
 * Returns the ColorScaleCriteria collection for this color scale.
 * @memberof ApiColorScale
 * @returns {ApiColorScaleCriterion[] | null}
 * @since 9.1.0
 */
ApiColorScale.prototype.GetColorScaleCriteria = function() { return [new ApiColorScaleCriterion()]; };

/**
 * Returns the ColorScaleCriteria collection for this color scale.
 * @memberof ApiColorScale
 * @returns {ApiColorScaleCriterion[] | null}
 * @since 9.1.0
 */
ApiColorScale.prototype.ColorScaleCriteria = ApiColorScale.prototype.GetColorScaleCriteria ();

/**
//  * Returns the formula for the color scale.
//  * @memberof ApiColorScale
//  * @returns {string}
//  * @since 9.1.0
//  */
// ApiColorScale.prototype.GetFormula = function() { return ""; };

/**
//  * Returns the formula for the color scale.
//  * @memberof ApiColorScale
//  * @returns {string}
//  * @since 9.1.0
//  */
// ApiColorScale.prototype.Formula = // ApiColorScale.prototype.GetFormula ();

/**
 * Returns the type of the color scale conditional formatting rule.
 * @memberof ApiColorScale
 * @returns {XlFormatConditionType}
 * @since 9.1.0
 */
ApiColorScale.prototype.GetType = function() { return new XlFormatConditionType(); };

/**
 * Returns the type of the color scale conditional formatting rule.
 * @memberof ApiColorScale
 * @returns {XlFormatConditionType}
 * @since 9.1.0
 */
ApiColorScale.prototype.Type = ApiColorScale.prototype.GetType ();

/**
 * Deletes the color scale conditional formatting rule.
 * @memberof ApiColorScale
 * @since 9.1.0
 */
ApiColorScale.prototype.Delete = ApiFormatCondition.prototype.Delete;{};

/**
 * Modifies the range to which this formatting rule applies.
 * @memberof ApiColorScale
 * @param {ApiRange} Range - A Range object representing the new range to which the formatting rule will be applied.
 * @since 9.1.0
 */
ApiColorScale.prototype.ModifyAppliesToRange = ApiFormatCondition.prototype.ModifyAppliesToRange;{};

/**
 * Sets the priority value for this conditional formatting rule to "1" so that it will be evaluated before all other rules on the worksheet.
 * @memberof ApiColorScale
 * @since 9.1.0
 */
ApiColorScale.prototype.SetFirstPriority = ApiFormatCondition.prototype.SetFirstPriority;{};

/**
 * Sets the evaluation order for this conditional formatting rule so it is evaluated after all other rules on the worksheet.
 * @memberof ApiColorScale
 * @since 9.1.0
 */
ApiColorScale.prototype.SetLastPriority = ApiFormatCondition.prototype.SetLastPriority;{};

/**
 * Returns the range to which the conditional formatting rule applies.
 * @memberof ApiColorScale
 * @returns {ApiRange}
 * @since 9.1.0
 */
ApiColorScale.prototype.GetAppliesTo = ApiFormatCondition.prototype.GetAppliesTo;{ return new ApiRange(); };

/**
 * Returns the parent object for the specified object.
 * @memberof ApiColorScale
 * @returns {ApiRange}
 * @since 9.1.0
 */
ApiColorScale.prototype.GetParent = ApiFormatCondition.prototype.GetParent;{ return new ApiRange(); };

/**
 * Returns the priority value of the conditional formatting rule.
 * @memberof ApiColorScale
 * @returns {number}
 * @since 9.1.0
 */
ApiColorScale.prototype.GetPriority = ApiFormatCondition.prototype.GetPriority;{ return 0; };

/**
 * Sets the priority value of the conditional formatting rule.
 * @memberof ApiColorScale
 * @param {number} Priority - The priority value (1-based).
 * @since 9.1.0
 */
ApiColorScale.prototype.SetPriority = ApiFormatCondition.prototype.SetPriority;{};

/**
 * Returns the pivot table condition object.
 * @memberof ApiColorScale
 * @returns {PTCondition | null}
 * @since 9.1.0
 */
ApiColorScale.prototype.GetPTCondition = ApiFormatCondition.prototype.GetPTCondition;{ return new PTCondition(); };

/**
 * Returns the scope type of the conditional formatting rule.
 * @memberof ApiColorScale
 * @returns {XlPivotConditionScope}
 * @since 9.1.0
 */
ApiColorScale.prototype.GetScopeType = ApiFormatCondition.prototype.GetScopeType;{ return new XlPivotConditionScope(); };

/**
 * Sets the scope type of the conditional formatting rule.
 * @memberof ApiColorScale
 * @param {XlPivotConditionScope} ScopeType - The scope type.
 * @since 9.1.0
 */
ApiColorScale.prototype.SetScopeType = ApiFormatCondition.prototype.SetScopeType;{};

/**
 * Returns whether Excel will stop evaluating additional formatting rules if this rule evaluates to True.
 * @memberof ApiColorScale
 * @returns {boolean}
 * @since 9.1.0
 */
ApiColorScale.prototype.GetStopIfTrue = ApiFormatCondition.prototype.GetStopIfTrue;{ return true; };

/**
 * Sets whether Excel will stop evaluating additional formatting rules if this rule evaluates to True.
 * @memberof ApiColorScale
 * @param {boolean} StopIfTrue - True to stop evaluating additional rules.
 * @since 9.1.0
 */
ApiColorScale.prototype.SetStopIfTrue = ApiFormatCondition.prototype.SetStopIfTrue;{};

/**
 * Class representing a single ColorScaleCriterion object.
 * @constructor
 */
function ApiColorScaleCriterion(cfvo, color, parent, index) {}

/**
 * Returns the type of the color scale criterion.
 * @memberof ApiColorScaleCriterion
 * @returns {XlConditionValueTypes | null}
 * @since 9.1.0
 */
ApiColorScaleCriterion.prototype.GetType = function() { return new XlConditionValueTypes(); };

/**
 * Sets the type of the color scale criterion.
 * @memberof ApiColorScaleCriterion
 * @param {XlConditionValueTypes} type - The type of the criterion.
 * @since 9.1.0
 */
ApiColorScaleCriterion.prototype.SetType = function(type) {};

/**
 * Sets the type of the color scale criterion.
 * @memberof ApiColorScaleCriterion
 * @param {XlConditionValueTypes} type - The type of the criterion.
 * @since 9.1.0
 */
ApiColorScaleCriterion.prototype.Type = ApiColorScaleCriterion.prototype.SetType ();

/**
 * Returns the value of the color scale criterion.
 * @memberof ApiColorScaleCriterion
 * @returns {string | null}
 * @since 9.1.0
 */
ApiColorScaleCriterion.prototype.GetValue = function() { return ""; };

/**
 * Sets the value of the color scale criterion.
 * @memberof ApiColorScaleCriterion
 * @param {string} value - The value of the criterion.
 * @since 9.1.0
 */
ApiColorScaleCriterion.prototype.SetValue = function(value) {};

/**
 * Sets the value of the color scale criterion.
 * @memberof ApiColorScaleCriterion
 * @param {string} value - The value of the criterion.
 * @since 9.1.0
 */
ApiColorScaleCriterion.prototype.Value = ApiColorScaleCriterion.prototype.SetValue ();

/**
 * Returns the index indicating which threshold the criteria represents.
 * @memberof ApiColorScaleCriterion
 * @returns {number} Returns 1 for minimum threshold, 2 for midpoint (3-color scale) or maximum (2-color scale), and 3 for maximum threshold (3-color scale only).
 * @since 9.1.0
 */
ApiColorScaleCriterion.prototype.GetIndex = function() { return 0; };

/**
 * Returns the index indicating which threshold the criteria represents.
 * @memberof ApiColorScaleCriterion
 * @returns {number} Returns 1 for minimum threshold, 2 for midpoint (3-color scale) or maximum (2-color scale), and 3 for maximum threshold (3-color scale only).
 * @since 9.1.0
 */
ApiColorScaleCriterion.prototype.Index = ApiColorScaleCriterion.prototype.GetIndex ();

/**
 * Returns the format color of the color scale criterion.
 * @memberof ApiColorScaleCriterion
 * @returns {ApiColor | null}
 * @since 9.1.0
 */
ApiColorScaleCriterion.prototype.GetColor = function() { return new ApiColor(); };

/**
 * Sets the format color of the color scale criterion.
 * @memberof ApiColorScaleCriterion
 * @param {ApiColor} oColor - The ApiColor object specifying the color.
 * @since 9.1.0
 */
ApiColorScaleCriterion.prototype.SetColor = function(oColor) {};

/**
 * Sets the format color of the color scale criterion.
 * @memberof ApiColorScaleCriterion
 * @param {ApiColor} oColor - The ApiColor object specifying the color.
 * @since 9.1.0
 */
ApiColorScaleCriterion.prototype.Color = ApiColorScaleCriterion.prototype.SetColor ();

/**
 * Class representing a data bar conditional formatting rule.
 * @constructor
 * @extends ApiFormatCondition
 */
function ApiDatabar(rule, range, _parent) {}
ApiDatabar.prototype = Object.create(ApiFormatCondition.prototype);
ApiDatabar.prototype.constructor = ApiDatabar;

/**
 * Sets the axis color of the data bar.
 * @memberof ApiDatabar
 * @param {ApiColor} oColor - The axis color.
 * @since 9.1.0
 */
ApiDatabar.prototype.SetAxisColor = function(oColor){};

/**
 * Sets the axis color of the data bar.
 * @memberof ApiDatabar
 * @param {ApiColor} oColor - The axis color.
 * @since 9.1.0
 */
ApiDatabar.prototype.AxisColor = ApiDatabar.prototype.SetAxisColor ();

/**
 * Returns the axis position of the data bar.
 * @memberof ApiDatabar
 * @returns {XlDataBarAxisPosition} The axis position setting for the data bar.
 * @since 9.1.0
 */
ApiDatabar.prototype.GetAxisPosition = function() { return new XlDataBarAxisPosition(); };

/**
 * Sets the axis position of the data bar.
 * @memberof ApiDatabar
 * @param {XlDataBarAxisPosition} position - The axis position setting for the data bar.
 * @since 9.1.0
 */
ApiDatabar.prototype.SetAxisPosition = function(position) {};

/**
 * Sets the axis position of the data bar.
 * @memberof ApiDatabar
 * @param {XlDataBarAxisPosition} position - The axis position setting for the data bar.
 * @since 9.1.0
 */
ApiDatabar.prototype.AxisPosition = ApiDatabar.prototype.SetAxisPosition ();

/**
 * Returns the show value setting of the data bar.
 * @memberof ApiDatabar
 * @returns {boolean} True if the data bar shows the value, false otherwise.
 * @since 9.1.0
 */
ApiDatabar.prototype.GetShowValue = function() { return true; };

/**
 * Sets the show value setting of the data bar.
 * @memberof ApiDatabar
 * @param {boolean} showValue - True to show the value, false to hide it.
 * @since 9.1.0
 */
ApiDatabar.prototype.SetShowValue = function(showValue) {};

/**
 * Sets the show value setting of the data bar.
 * @memberof ApiDatabar
 * @param {boolean} showValue - True to show the value, false to hide it.
 * @since 9.1.0
 */
ApiDatabar.prototype.ShowValue = ApiDatabar.prototype.SetShowValue ();

/**
 * Returns the direction of the data bar.
 * @memberof ApiDatabar
 * @returns {XlReadingOrder} The direction setting for the data bar.
 * @since 9.1.0
 */
ApiDatabar.prototype.GetDirection = function() { return new XlReadingOrder(); };

/**
 * Sets the direction of the data bar.
 * @memberof ApiDatabar
 * @param {XlReadingOrder} direction - The direction setting for the data bar.
 * @since 9.1.0
 */
ApiDatabar.prototype.SetDirection = function(direction) {};

/**
 * Sets the direction of the data bar.
 * @memberof ApiDatabar
 * @param {XlReadingOrder} direction - The direction setting for the data bar.
 * @since 9.1.0
 */
ApiDatabar.prototype.Direction = ApiDatabar.prototype.SetDirection ();

/**
 * Returns the bar color of the data bar.
 * @memberof ApiDatabar
 * @returns {ApiColor | null} Returns the ApiColor object representing the bar color, or null if not specified.
 * @since 9.1.0
 */
ApiDatabar.prototype.GetBarColor = function() { return new ApiColor(); };

/**
 * Sets the bar color of the data bar.
 * @memberof ApiDatabar
 * @param {ApiColor} oColor - The ApiColor object for the bar.
 * @since 9.1.0
 */
ApiDatabar.prototype.SetBarColor = function(oColor) {};

/**
 * Sets the bar color of the data bar.
 * @memberof ApiDatabar
 * @param {ApiColor} oColor - The ApiColor object for the bar.
 * @since 9.1.0
 */
ApiDatabar.prototype.BarColor = ApiDatabar.prototype.SetBarColor ();

/**
 * Returns the bar fill type of the data bar.
 * @memberof ApiDatabar
 * @returns {XlDataBarFillType} The fill type setting for the data bar.
 * @since 9.1.0
 */
ApiDatabar.prototype.GetBarFillType = function() { return new XlDataBarFillType(); };

/**
 * Sets the bar fill type of the data bar.
 * @memberof ApiDatabar
 * @param {XlDataBarFillType} fillType - The fill type setting for the data bar.
 * @since 9.1.0
 */
ApiDatabar.prototype.SetBarFillType = function(fillType) {};

/**
 * Sets the bar fill type of the data bar.
 * @memberof ApiDatabar
 * @param {XlDataBarFillType} fillType - The fill type setting for the data bar.
 * @since 9.1.0
 */
ApiDatabar.prototype.BarFillType = ApiDatabar.prototype.SetBarFillType ();

/**
 * Returns the type of the minimum point condition value.
 * @memberof ApiDatabar
 * @returns {XlConditionValueTypes | null} The type of the minimum condition value.
 * @since 9.1.0
 */
ApiDatabar.prototype.GetMinPointType = function() { return new XlConditionValueTypes(); };

/**
 * Sets the type of the minimum point condition value.
 * @memberof ApiDatabar
 * @param {XlConditionValueTypes} type - The type of the condition value.
 * @since 9.1.0
 */
ApiDatabar.prototype.SetMinPointType = function(type) {};

/**
 * Returns the value of the minimum point condition value.
 * @memberof ApiDatabar
 * @returns {string | number | null} The value of the minimum condition value.
 * @since 9.1.0
 */
ApiDatabar.prototype.GetMinPointValue = function() { return ""; };

/**
 * Sets the value of the minimum point condition value.
 * @memberof ApiDatabar
 * @param {string | number} value - The value of the condition value.
 * @since 9.1.0
 */
ApiDatabar.prototype.SetMinPointValue = function(value) {};

/**
 * Sets the value of the minimum point condition value.
 * @memberof ApiDatabar
 * @param {string | number} value - The value of the condition value.
 * @since 9.1.0
 */
ApiDatabar.prototype.MinPoint = ApiDatabar.prototype.SetMinPointValue ();

/**
 * Returns the type of the maximum point condition value.
 * @memberof ApiDatabar
 * @returns {XlConditionValueTypes | null} The type of the maximum condition value.
 * @since 9.1.0
 */
ApiDatabar.prototype.GetMaxPointType = function() { return new XlConditionValueTypes(); };

/**
 * Sets the type of the maximum point condition value.
 * @memberof ApiDatabar
 * @param {XlConditionValueTypes} type - The type of the condition value.
 * @since 9.1.0
 */
ApiDatabar.prototype.SetMaxPointType = function(type) {};

/**
 * Returns the value of the maximum point condition value.
 * @memberof ApiDatabar
 * @returns {string | number | null} The value of the maximum condition value.
 * @since 9.1.0
 */
ApiDatabar.prototype.GetMaxPointValue = function() { return ""; };

/**
 * Sets the value of the maximum point condition value.
 * @memberof ApiDatabar
 * @param {string | number} value - The value of the condition value.
 * @since 9.1.0
 */
ApiDatabar.prototype.SetMaxPointValue = function(value) {};

/**
 * Sets the value of the maximum point condition value.
 * @memberof ApiDatabar
 * @param {string | number} value - The value of the condition value.
 * @since 9.1.0
 */
ApiDatabar.prototype.MaxPoint = ApiDatabar.prototype.SetMaxPointValue ();

/**
//  * Returns the negative bar format of the data bar.
//  * @memberof ApiDatabar
//  * @returns {ApiNegativeBarFormat | null} Returns the negative bar format object.
//  * @since 9.1.0
//  */
// ApiDatabar.prototype.GetNegativeBarFormat = function() { return new ApiNegativeBarFormat(); };

/**
//  * Returns the negative bar format of the data bar.
//  * @memberof ApiDatabar
//  * @returns {ApiNegativeBarFormat | null} Returns the negative bar format object.
//  * @since 9.1.0
//  */
// ApiDatabar.prototype.NegativeBarFormat = // ApiDatabar.prototype.GetNegativeBarFormat ();

/**
 * Returns the negative bar color of the data bar.
 * @memberof ApiDatabar
 * @returns {ApiColor | null} Returns the ApiColor object representing the negative bar color, or null if not specified.
 * @since 9.1.0
 */
ApiDatabar.prototype.GetNegativeBarColor = function() { return new ApiColor(); };

/**
 * Sets the negative bar color of the data bar.
 * @memberof ApiDatabar
 * @param {ApiColor} oColor - The ApiColor object for the negative bars.
 * @since 9.1.0
 */
ApiDatabar.prototype.SetNegativeBarColor = function(oColor) {};

/**
 * Sets the negative bar color of the data bar.
 * @memberof ApiDatabar
 * @param {ApiColor} oColor - The ApiColor object for the negative bars.
 * @since 9.1.0
 */
ApiDatabar.prototype.NegativeBarColor = ApiDatabar.prototype.SetNegativeBarColor ();

/**
 * Returns the negative bar border color of the data bar.
 * @memberof ApiDatabar
 * @returns {ApiColor | null} Returns the ApiColor object representing the negative bar border color, or null if not specified.
 * @since 9.1.0
 */
ApiDatabar.prototype.GetNegativeBorderColor = function() { return new ApiColor(); };

/**
 * Sets the negative bar border color of the data bar.
 * @memberof ApiDatabar
 * @param {ApiColor} oColor - The ApiColor object for the negative bar borders.
 * @since 9.1.0
 */
ApiDatabar.prototype.SetNegativeBorderColor = function(oColor) {};

/**
 * Sets the negative bar border color of the data bar.
 * @memberof ApiDatabar
 * @param {ApiColor} oColor - The ApiColor object for the negative bar borders.
 * @since 9.1.0
 */
ApiDatabar.prototype.NegativeBorderColor = ApiDatabar.prototype.SetNegativeBorderColor ();

/**
//  * Returns the bar border of the data bar.
//  * @memberof ApiDatabar
//  * @returns {ApiDataBarBorder | null} Returns the data bar border object.
//  * @since 9.1.0
//  */
// ApiDatabar.prototype.GetBarBorder = function() { return new ApiDataBarBorder(); };

/**
//  * Returns the bar border of the data bar.
//  * @memberof ApiDatabar
//  * @returns {ApiDataBarBorder | null} Returns the data bar border object.
//  * @since 9.1.0
//  */
// ApiDatabar.prototype.BarBorder = // ApiDatabar.prototype.GetBarBorder ();

/**
 * Returns the bar color of the data bar.
 * @memberof ApiDatabar
 * @returns {ApiColor | null} Returns the ApiColor object representing the bar color, or null if not specified.
 * @since 9.1.0
 */
ApiDatabar.prototype.GetBarBorderColor = function() { return new ApiColor(); };

/**
 * Sets the bar color of the data bar.
 * @memberof ApiDatabar
 * @param {ApiColor} oColor - The ApiColor object for the bar.
 * @since 9.1.0
 */
ApiDatabar.prototype.SetBarBorderColor = function(oColor) {};

/**
 * Returns the percent maximum value of the data bar.
 * @memberof ApiDatabar
 * @returns {number} Returns the maximum length as percentage.
 * @since 9.1.0
 */
ApiDatabar.prototype.GetPercentMax = function() { return 0; };

/**
 * Sets the percent maximum value of the data bar.
 * @memberof ApiDatabar
 * @param {number} percent - The maximum length as percentage.
 * @since 9.1.0
 */
ApiDatabar.prototype.SetPercentMax = function(percent) {};

/**
 * Sets the percent maximum value of the data bar.
 * @memberof ApiDatabar
 * @param {number} percent - The maximum length as percentage.
 * @since 9.1.0
 */
ApiDatabar.prototype.PercentMax = ApiDatabar.prototype.SetPercentMax ();

/**
 * Returns the percent minimum value of the data bar.
 * @memberof ApiDatabar
 * @returns {number} Returns the minimum length as percentage.
 * @since 9.1.0
 */
ApiDatabar.prototype.GetPercentMin = function() { return 0; };

/**
 * Sets the percent minimum value of the data bar.
 * @memberof ApiDatabar
 * @param {number} percent - The minimum length as percentage.
 * @since 9.1.0
 */
ApiDatabar.prototype.SetPercentMin = function(percent) {};

/**
 * Sets the percent minimum value of the data bar.
 * @memberof ApiDatabar
 * @param {number} percent - The minimum length as percentage.
 * @since 9.1.0
 */
ApiDatabar.prototype.PercentMin = ApiDatabar.prototype.SetPercentMin ();

/**
 * Returns the formula for the data bar.
 * @memberof ApiDatabar
 * @returns {string} Returns the formula string.
 * @since 9.1.0
 */
ApiDatabar.prototype.GetFormula = function() { return ""; };

/**
 * Returns the formula for the data bar.
 * @memberof ApiDatabar
 * @returns {string} Returns the formula string.
 * @since 9.1.0
 */
ApiDatabar.prototype.Formula = ApiDatabar.prototype.GetFormula ();

/**
 * Returns the type of the data bar conditional formatting rule.
 * @memberof ApiDatabar
 * @returns {XlFormatConditionType} Returns "xlDatabar".
 * @since 9.1.0
 */
ApiDatabar.prototype.GetType = function() { return new XlFormatConditionType(); };

/**
 * Returns the type of the data bar conditional formatting rule.
 * @memberof ApiDatabar
 * @returns {XlFormatConditionType} Returns "xlDatabar".
 * @since 9.1.0
 */
ApiDatabar.prototype.Type = ApiDatabar.prototype.GetType ();

/**
 * Deletes the data bar conditional formatting rule.
 * @memberof ApiDatabar
 * @since 9.1.0
 */
ApiDatabar.prototype.Delete = ApiFormatCondition.prototype.Delete;{};

/**
 * Modifies the range to which this formatting rule applies.
 * @memberof ApiDatabar
 * @param {ApiRange} Range - A Range object representing the new range to which the formatting rule will be applied.
 * @since 9.1.0
 */
ApiDatabar.prototype.ModifyAppliesToRange = ApiFormatCondition.prototype.ModifyAppliesToRange;{};

/**
 * Sets the priority value for this conditional formatting rule to "1" so that it will be evaluated before all other rules on the worksheet.
 * @memberof ApiDatabar
 * @since 9.1.0
 */
ApiDatabar.prototype.SetFirstPriority = ApiFormatCondition.prototype.SetFirstPriority;{};

/**
 * Sets the evaluation order for this conditional formatting rule so it is evaluated after all other rules on the worksheet.
 * @memberof ApiDatabar
 * @since 9.1.0
 */
ApiDatabar.prototype.SetLastPriority = ApiFormatCondition.prototype.SetLastPriority;{};

/**
 * Returns the range to which the conditional formatting rule applies.
 * @memberof ApiDatabar
 * @returns {ApiRange}
 * @since 9.1.0
 */
ApiDatabar.prototype.GetAppliesTo = ApiFormatCondition.prototype.GetAppliesTo;{ return new ApiRange(); };

/**
 * Returns the parent object for the specified object.
 * @memberof ApiDatabar
 * @returns {ApiRange}
 * @since 9.1.0
 */
ApiDatabar.prototype.GetParent = ApiFormatCondition.prototype.GetParent;{ return new ApiRange(); };

/**
 * Returns the priority value of the conditional formatting rule.
 * @memberof ApiDatabar
 * @returns {number}
 * @since 9.1.0
 */
ApiDatabar.prototype.GetPriority = ApiFormatCondition.prototype.GetPriority;{ return 0; };

/**
 * Sets the priority value of the conditional formatting rule.
 * @memberof ApiDatabar
 * @param {number} Priority - The priority value (1-based).
 * @since 9.1.0
 */
ApiDatabar.prototype.SetPriority = ApiFormatCondition.prototype.SetPriority;{};

/**
 * Returns the pivot table condition object.
 * @memberof ApiDatabar
 * @returns {PTCondition | null}
 * @since 9.1.0
 */
ApiDatabar.prototype.GetPTCondition = ApiFormatCondition.prototype.GetPTCondition;{ return new PTCondition(); };

/**
 * Returns the scope type of the conditional formatting rule.
 * @memberof ApiDatabar
 * @returns {XlPivotConditionScope}
 * @since 9.1.0
 */
ApiDatabar.prototype.GetScopeType = ApiFormatCondition.prototype.GetScopeType;{ return new XlPivotConditionScope(); };

/**
 * Sets the scope type of the conditional formatting rule.
 * @memberof ApiDatabar
 * @param {XlPivotConditionScope} ScopeType - The scope type.
 * @since 9.1.0
 */
ApiDatabar.prototype.SetScopeType = ApiFormatCondition.prototype.SetScopeType;{};

/**
 * Returns whether Excel will stop evaluating additional formatting rules if this rule evaluates to True.
 * @memberof ApiDatabar
 * @returns {boolean}
 * @since 9.1.0
 */
ApiDatabar.prototype.GetStopIfTrue = ApiFormatCondition.prototype.GetStopIfTrue;{ return true; };

/**
 * Sets whether Excel will stop evaluating additional formatting rules if this rule evaluates to True.
 * @memberof ApiDatabar
 * @param {boolean} StopIfTrue - True to stop evaluating additional rules.
 * @since 9.1.0
 */
ApiDatabar.prototype.SetStopIfTrue = ApiFormatCondition.prototype.SetStopIfTrue;{};

/**
 * Class representing an icon set conditional formatting rule.
 * @constructor
 * @extends ApiFormatCondition
 */
function ApiIconSetCondition(rule, range, _parent) {}
ApiIconSetCondition.prototype = Object.create(ApiFormatCondition.prototype);
ApiIconSetCondition.prototype.constructor = ApiIconSetCondition;

/**
 * Returns the icon set type used in the conditional formatting rule.
 * @memberof ApiIconSetCondition
 * @returns {XlIconSet | null} The icon set type, or null if not applicable.
 * @since 9.1.0
 */
ApiIconSetCondition.prototype.GetIconSet = function() { return new XlIconSet(); };

/**
 * Sets the icon set type for the conditional formatting rule.
 * @memberof ApiIconSetCondition
 * @param {XlIconSet} iconSet - The icon set type to apply.
 * @returns {boolean} True if the icon set was successfully set, false otherwise.
 * @since 9.1.0
 */
ApiIconSetCondition.prototype.SetIconSet = function(iconSet) { return true; };

/**
 * Sets the icon set type for the conditional formatting rule.
 * @memberof ApiIconSetCondition
 * @param {XlIconSet} iconSet - The icon set type to apply.
 * @returns {boolean} True if the icon set was successfully set, false otherwise.
 * @since 9.1.0
 */
ApiIconSetCondition.prototype.IconSet = ApiIconSetCondition.prototype.SetIconSet ();

/**
 * Returns whether the thresholds for the icon set conditional format are determined by using percentiles.
 * @memberof ApiIconSetCondition
 * @returns {boolean} True if all thresholds are set to percentile, false otherwise.
 * @since 9.1.0
 */
ApiIconSetCondition.prototype.GetPercentileValues = function() { return true; };

/**
 * Sets whether the thresholds for the icon set conditional format are determined by using percentiles.
 * @memberof ApiIconSetCondition
 * @param {boolean} percentileValues - True to set all thresholds to percentile, false otherwise.
 * @since 9.1.0
 */
ApiIconSetCondition.prototype.SetPercentileValues = function(percentileValues) {};

/**
 * Sets whether the thresholds for the icon set conditional format are determined by using percentiles.
 * @memberof ApiIconSetCondition
 * @param {boolean} percentileValues - True to set all thresholds to percentile, false otherwise.
 * @since 9.1.0
 */
ApiIconSetCondition.prototype.PercentileValues = ApiIconSetCondition.prototype.SetPercentileValues ();

/**
 * Returns whether the icon order is reversed.
 * @memberof ApiIconSetCondition
 * @returns {boolean | null} True if the icon order is reversed, false otherwise, or null if not applicable.
 * @since 9.1.0
 */
ApiIconSetCondition.prototype.GetReverseOrder = function() { return true; };

/**
 * Sets whether the icon order should be reversed.
 * @memberof ApiIconSetCondition
 * @param {boolean} reverse - True to reverse the icon order, false otherwise.
 * @returns {boolean} True if the setting was successfully applied, false otherwise.
 * @since 9.1.0
 */
ApiIconSetCondition.prototype.SetReverseOrder = function(reverse) { return true; };

/**
 * Sets whether the icon order should be reversed.
 * @memberof ApiIconSetCondition
 * @param {boolean} reverse - True to reverse the icon order, false otherwise.
 * @returns {boolean} True if the setting was successfully applied, false otherwise.
 * @since 9.1.0
 */
ApiIconSetCondition.prototype.ReverseOrder = ApiIconSetCondition.prototype.SetReverseOrder ();

/**
 * Returns whether only icons are displayed (without cell values).
 * @memberof ApiIconSetCondition
 * @returns {boolean | null} True if only icons are shown, false if values are also shown, or null if not applicable.
 * @since 9.1.0
 */
ApiIconSetCondition.prototype.GetShowIconOnly = function() { return true; };

/**
 * Sets whether to display only icons (without cell values).
 * @memberof ApiIconSetCondition
 * @param {boolean} showIconOnly - True to show only icons, false to show both icons and values.
 * @returns {boolean} True if the setting was successfully applied, false otherwise.
 * @since 9.1.0
 */
ApiIconSetCondition.prototype.SetShowIconOnly = function(showIconOnly) { return true; };

/**
 * Sets whether to display only icons (without cell values).
 * @memberof ApiIconSetCondition
 * @param {boolean} showIconOnly - True to show only icons, false to show both icons and values.
 * @returns {boolean} True if the setting was successfully applied, false otherwise.
 * @since 9.1.0
 */
ApiIconSetCondition.prototype.ShowIconOnly = ApiIconSetCondition.prototype.SetShowIconOnly ();

/**
 * Returns a collection of icon criteria that represent the threshold values and icons for the icon set conditional formatting rule.
 * @memberof ApiIconSetCondition
 * @returns {ApiIconCriterion[] | null} Collection of icon criteria objects, or null if the rule is not an icon set type.
 * @since 9.1.0
 */
ApiIconSetCondition.prototype.GetIconCriteria = function() { return [new ApiIconCriterion()]; };

/**
 * Returns a collection of icon criteria that represent the threshold values and icons for the icon set conditional formatting rule.
 * @memberof ApiIconSetCondition
 * @returns {ApiIconCriterion[] | null} Collection of icon criteria objects, or null if the rule is not an icon set type.
 * @since 9.1.0
 */
ApiIconSetCondition.prototype.IconCriteria = ApiIconSetCondition.prototype.GetIconCriteria ();

/**
 * Returns the formula associated with the icon set condition.
 * @memberof ApiIconSetCondition
 * @returns {string} The formula string, or empty string if no formula is set.
 * @since 9.1.0
 */
ApiIconSetCondition.prototype.GetFormula = function() { return ""; };

/**
 * Returns the formula associated with the icon set condition.
 * @memberof ApiIconSetCondition
 * @returns {string} The formula string, or empty string if no formula is set.
 * @since 9.1.0
 */
ApiIconSetCondition.prototype.Formula = ApiIconSetCondition.prototype.GetFormula ();

/**
 * Returns the type of the icon set conditional formatting rule.
 * @memberof ApiIconSetCondition
 * @returns {XlFormatConditionType} Returns "xlIconSets".
 * @since 9.1.0
 */
ApiIconSetCondition.prototype.GetType = function() { return new XlFormatConditionType(); };

/**
 * Returns the type of the icon set conditional formatting rule.
 * @memberof ApiIconSetCondition
 * @returns {XlFormatConditionType} Returns "xlIconSets".
 * @since 9.1.0
 */
ApiIconSetCondition.prototype.Type = ApiIconSetCondition.prototype.GetType ();

/**
 * Deletes the icon set conditional formatting rule.
 * @memberof ApiIconSetCondition
 * @since 9.1.0
 */
ApiIconSetCondition.prototype.Delete = ApiFormatCondition.prototype.Delete;{};

/**
 * Modifies the range to which this formatting rule applies.
 * @memberof ApiIconSetCondition
 * @param {ApiRange} Range - A Range object representing the new range to which the formatting rule will be applied.
 * @since 9.1.0
 */
ApiIconSetCondition.prototype.ModifyAppliesToRange = ApiFormatCondition.prototype.ModifyAppliesToRange;{};

/**
 * Sets the priority value for this conditional formatting rule to "1" so that it will be evaluated before all other rules on the worksheet.
 * @memberof ApiIconSetCondition
 * @since 9.1.0
 */
ApiIconSetCondition.prototype.SetFirstPriority = ApiFormatCondition.prototype.SetFirstPriority;{};

/**
 * Sets the evaluation order for this conditional formatting rule so it is evaluated after all other rules on the worksheet.
 * @memberof ApiIconSetCondition
 * @since 9.1.0
 */
ApiIconSetCondition.prototype.SetLastPriority = ApiFormatCondition.prototype.SetLastPriority;{};

/**
 * Returns the range to which the conditional formatting rule applies.
 * @memberof ApiIconSetCondition
 * @returns {ApiRange}
 * @since 9.1.0
 */
ApiIconSetCondition.prototype.GetAppliesTo = ApiFormatCondition.prototype.GetAppliesTo;{ return new ApiRange(); };

/**
 * Returns the parent object for the specified object.
 * @memberof ApiIconSetCondition
 * @returns {ApiRange}
 * @since 9.1.0
 */
ApiIconSetCondition.prototype.GetParent = ApiFormatCondition.prototype.GetParent;{ return new ApiRange(); };

/**
 * Returns the priority value of the conditional formatting rule.
 * @memberof ApiIconSetCondition
 * @returns {number}
 * @since 9.1.0
 */
ApiIconSetCondition.prototype.GetPriority = ApiFormatCondition.prototype.GetPriority;{ return 0; };

/**
 * Sets the priority value of the conditional formatting rule.
 * @memberof ApiIconSetCondition
 * @param {number} Priority - The priority value (1-based).
 * @since 9.1.0
 */
ApiIconSetCondition.prototype.SetPriority = ApiFormatCondition.prototype.SetPriority;{};

/**
 * Returns the pivot table condition object.
 * @memberof ApiIconSetCondition
 * @returns {PTCondition | null}
 * @since 9.1.0
 */
ApiIconSetCondition.prototype.GetPTCondition = ApiFormatCondition.prototype.GetPTCondition;{ return new PTCondition(); };

/**
 * Returns the scope type of the conditional formatting rule.
 * @memberof ApiIconSetCondition
 * @returns {XlPivotConditionScope}
 * @since 9.1.0
 */
ApiIconSetCondition.prototype.GetScopeType = ApiFormatCondition.prototype.GetScopeType;{ return new XlPivotConditionScope(); };

/**
 * Sets the scope type of the conditional formatting rule.
 * @memberof ApiIconSetCondition
 * @param {XlPivotConditionScope} ScopeType - The scope type.
 * @since 9.1.0
 */
ApiIconSetCondition.prototype.SetScopeType = ApiFormatCondition.prototype.SetScopeType;{};

/**
 * Returns whether Excel will stop evaluating additional formatting rules if this rule evaluates to True.
 * @memberof ApiIconSetCondition
 * @returns {boolean}
 * @since 9.1.0
 */
ApiIconSetCondition.prototype.GetStopIfTrue = ApiFormatCondition.prototype.GetStopIfTrue;{ return true; };

/**
 * Sets whether Excel will stop evaluating additional formatting rules if this rule evaluates to True.
 * @memberof ApiIconSetCondition
 * @param {boolean} StopIfTrue - True to stop evaluating additional rules.
 * @since 9.1.0
 */
ApiIconSetCondition.prototype.SetStopIfTrue = ApiFormatCondition.prototype.SetStopIfTrue;{};

/**
//  * Class representing a collection of icon criteria.
//  * @constructor
//  */

/**
//  * Returns the count of icon criteria in the collection.
//  * @memberof ApiIconCriteria
//  * @returns {number} The number of icon criteria.
//  * @since 9.1.0
//  */
// ApiIconCriteria.prototype.GetCount = function() { return 0; };

/**
//  * Returns the count of icon criteria in the collection.
//  * @memberof ApiIconCriteria
//  * @returns {number} The number of icon criteria.
//  * @since 9.1.0
//  */
// ApiIconCriteria.prototype.Count = // ApiIconCriteria.prototype.GetCount ();

/**
//  * Returns an icon criterion by its index.
//  * @memberof ApiIconCriteria
//  * @param {number} index - The index of the criterion (1-based).
//  * @returns {ApiIconCriterion | null} The icon criterion object, or null if index is invalid.
//  * @since 9.1.0
//  */
// ApiIconCriteria.prototype.GetItem = function(index) { return new ApiIconCriterion(); };

/**
 * Class representing a single icon criterion.
 * @constructor
 */
function ApiIconCriterion(cfvo, iconSet, iconSetElement, parent, index) {}

/**
 * Returns the condition value type for the icon criterion.
 * @memberof ApiIconCriterion
 * @returns {XlConditionValueTypes | null} The condition value type, or null if not available.
 * @since 9.1.0
 */
ApiIconCriterion.prototype.GetType = function() { return new XlConditionValueTypes(); };

/**
 * Sets the condition value type for the icon criterion.
 * @memberof ApiIconCriterion
 * @param {XlConditionValueTypes} type - The condition value type. Only xlConditionValueNumber, xlConditionValuePercent, xlConditionValuePercentile, or xlConditionValueFormula are supported.
 * @since 9.1.0
 */
ApiIconCriterion.prototype.SetType = function(type) {};

/**
 * Sets the condition value type for the icon criterion.
 * @memberof ApiIconCriterion
 * @param {XlConditionValueTypes} type - The condition value type. Only xlConditionValueNumber, xlConditionValuePercent, xlConditionValuePercentile, or xlConditionValueFormula are supported.
 * @since 9.1.0
 */
ApiIconCriterion.prototype.Type = ApiIconCriterion.prototype.SetType ();

/**
 * Returns the threshold value for the icon criterion.
 * @memberof ApiIconCriterion
 * @returns {string | number | null} The threshold value, or null if not available.
 * @since 9.1.0
 */
ApiIconCriterion.prototype.GetValue = function() { return ""; };

/**
 * Sets the threshold value for the icon criterion.
 * @memberof ApiIconCriterion
 * @param {string | number} value - The threshold value to set.
 * @since 9.1.0
 */
ApiIconCriterion.prototype.SetValue = function(value) {};

/**
 * Sets the threshold value for the icon criterion.
 * @memberof ApiIconCriterion
 * @param {string | number} value - The threshold value to set.
 * @since 9.1.0
 */
ApiIconCriterion.prototype.Value = ApiIconCriterion.prototype.SetValue ();

/**
 * Returns the comparison operator for the icon criterion.
 * @memberof ApiIconCriterion
 * @returns {string | null} The operator ("xlGreaterEqual" or "xlGreater"), or null if not available.
 * @since 9.1.0
 */
ApiIconCriterion.prototype.GetOperator = function() { return ""; };

/**
 * Sets the comparison operator for the icon criterion.
 * @memberof ApiIconCriterion
 * @param {string} operator - The operator to set ("xlGreaterEqual" or "xlGreater").
 * @since 9.1.0
 */
ApiIconCriterion.prototype.SetOperator = function(operator) {};

/**
 * Sets the comparison operator for the icon criterion.
 * @memberof ApiIconCriterion
 * @param {string} operator - The operator to set ("xlGreaterEqual" or "xlGreater").
 * @since 9.1.0
 */
ApiIconCriterion.prototype.Operator = ApiIconCriterion.prototype.SetOperator ();

/**
 * Returns the index of the icon criterion in the collection.
 * @memberof ApiIconCriterion
 * @returns {number} The 1-based index of the criterion.
 * @since 9.1.0
 */
ApiIconCriterion.prototype.GetIndex = function() { return 0; };

/**
 * Returns the index of the icon criterion in the collection.
 * @memberof ApiIconCriterion
 * @returns {number} The 1-based index of the criterion.
 * @since 9.1.0
 */
ApiIconCriterion.prototype.Index = ApiIconCriterion.prototype.GetIndex ();

/**
 * Returns the icon associated with this criterion.
 * @memberof ApiIconCriterion
 * @returns {XlIcon | null} The icon constant, or null if not available.
 * @since 9.1.0
 */
ApiIconCriterion.prototype.GetIcon = function() { return new XlIcon(); };

/**
 * Sets the icon for this criterion.
 * @memberof ApiIconCriterion
 * @param {XlIcon} icon - The icon constant to set.
 * @since 9.1.0
 */
ApiIconCriterion.prototype.SetIcon = function(icon) {};

/**
 * Sets the icon for this criterion.
 * @memberof ApiIconCriterion
 * @param {XlIcon} icon - The icon constant to set.
 * @since 9.1.0
 */
ApiIconCriterion.prototype.Icon = ApiIconCriterion.prototype.SetIcon ();

/**
 * Class representing a top 10 conditional formatting rule.
 * @constructor
 * @extends ApiFormatCondition
 */
function ApiTop10(rule, range, _parent) {}
ApiTop10.prototype = Object.create(ApiFormatCondition.prototype);
ApiTop10.prototype.constructor = ApiTop10;

/**
 * Returns the calculation scope for the top 10 condition in pivot tables.
 * @memberof ApiTop10
 * @returns {XlCalcFor}
 * @since 9.1.0
 */
ApiTop10.prototype.GetCalcFor = function() { return new XlCalcFor(); };

/**
 * Sets the calculation scope for the top 10 condition in pivot tables.
 * @memberof ApiTop10
 * @param {XlCalcFor} calcFor - The calculation scope
 * @since 9.1.0
 */
ApiTop10.prototype.SetCalcFor = function(calcFor) {};

/**
 * Sets the calculation scope for the top 10 condition in pivot tables.
 * @memberof ApiTop10
 * @param {XlCalcFor} calcFor - The calculation scope
 * @since 9.1.0
 */
ApiTop10.prototype.CalcFor = ApiTop10.prototype.SetCalcFor ();

/**
 * Returns one of the constants of the XlTopBottom enumeration, which determines if the ranking is evaluated from the top or bottom.
 * @memberof ApiTop10
 * @returns {XlTopBottom} The XlTopBottom enumeration constant.
 * @since 9.1.0
 */
ApiTop10.prototype.GetTopBottom = function() { return new XlTopBottom(); };

/**
 * Sets one of the constants of the XlTopBottom enumeration, which determines if the ranking is evaluated from the top or bottom.
 * @memberof ApiTop10
 * @param {XlTopBottom} topBottom - The XlTopBottom enumeration constant.
 * @since 9.1.0
 */
ApiTop10.prototype.SetTopBottom = function(topBottom) {};

/**
 * Sets one of the constants of the XlTopBottom enumeration, which determines if the ranking is evaluated from the top or bottom.
 * @memberof ApiTop10
 * @param {XlTopBottom} topBottom - The XlTopBottom enumeration constant.
 * @since 9.1.0
 */
ApiTop10.prototype.TopBottom = ApiTop10.prototype.SetTopBottom ();

/**
 * Returns whether the rank is percentage-based.
 * @memberof ApiTop10
 * @returns {boolean} True if percentage-based, false if count-based.
 * @since 9.1.0
 */
ApiTop10.prototype.GetPercent = function() { return true; };

/**
 * Sets whether the rank is percentage-based.
 * @memberof ApiTop10
 * @param {boolean} percent - True for percentage-based, false for count-based.
 * @since 9.1.0
 */
ApiTop10.prototype.SetPercent = function(percent) {};

/**
 * Sets whether the rank is percentage-based.
 * @memberof ApiTop10
 * @param {boolean} percent - True for percentage-based, false for count-based.
 * @since 9.1.0
 */
ApiTop10.prototype.Percent = ApiTop10.prototype.SetPercent ();

/**
 * Returns the rank value for the top 10 condition.
 * @memberof ApiTop10
 * @returns {number} The rank value.
 * @since 9.1.0
 */
ApiTop10.prototype.GetRank = function() { return 0; };

/**
 * Sets the rank value for the top 10 condition.
 * @memberof ApiTop10
 * @param {number} rank - The rank value.
 * @since 9.1.0
 */
ApiTop10.prototype.SetRank = function(rank) {};

/**
 * Sets the rank value for the top 10 condition.
 * @memberof ApiTop10
 * @param {number} rank - The rank value.
 * @since 9.1.0
 */
ApiTop10.prototype.Rank = ApiTop10.prototype.SetRank ();

/**
 * Returns the type of the top 10 conditional formatting rule.
 * @memberof ApiTop10
 * @returns {XlFormatConditionType}
 * @since 9.1.0
 */
ApiTop10.prototype.GetType = function() { return new XlFormatConditionType(); };

/**
 * Returns the type of the top 10 conditional formatting rule.
 * @memberof ApiTop10
 * @returns {XlFormatConditionType}
 * @since 9.1.0
 */
ApiTop10.prototype.Type = ApiTop10.prototype.GetType ();

/**
 * Deletes the top 10 conditional formatting rule.
 * @memberof ApiTop10
 * @since 9.1.0
 */
ApiTop10.prototype.Delete = ApiFormatCondition.prototype.Delete;{};

/**
 * Modifies the range to which this formatting rule applies.
 * @memberof ApiTop10
 * @param {ApiRange} Range - A Range object representing the new range to which the formatting rule will be applied.
 * @since 9.1.0
 */
ApiTop10.prototype.ModifyAppliesToRange = ApiFormatCondition.prototype.ModifyAppliesToRange;{};

/**
 * Sets the priority value for this conditional formatting rule to "1" so that it will be evaluated before all other rules on the worksheet.
 * @memberof ApiTop10
 * @since 9.1.0
 */
ApiTop10.prototype.SetFirstPriority = ApiFormatCondition.prototype.SetFirstPriority;{};

/**
 * Sets the evaluation order for this conditional formatting rule so it is evaluated after all other rules on the worksheet.
 * @memberof ApiTop10
 * @since 9.1.0
 */
ApiTop10.prototype.SetLastPriority = ApiFormatCondition.prototype.SetLastPriority;{};

/**
 * Returns the range to which the conditional formatting rule applies.
 * @memberof ApiTop10
 * @returns {ApiRange}
 * @since 9.1.0
 */
ApiTop10.prototype.GetAppliesTo = ApiFormatCondition.prototype.GetAppliesTo;{ return new ApiRange(); };

/**
 * Returns the parent object for the specified object.
 * @memberof ApiTop10
 * @returns {ApiRange}
 * @since 9.1.0
 */
ApiTop10.prototype.GetParent = ApiFormatCondition.prototype.GetParent;{ return new ApiRange(); };

/**
 * Returns the priority value of the conditional formatting rule.
 * @memberof ApiTop10
 * @returns {number}
 * @since 9.1.0
 */
ApiTop10.prototype.GetPriority = ApiFormatCondition.prototype.GetPriority;{ return 0; };

/**
 * Sets the priority value of the conditional formatting rule.
 * @memberof ApiTop10
 * @param {number} Priority - The priority value (1-based).
 * @since 9.1.0
 */
ApiTop10.prototype.SetPriority = ApiFormatCondition.prototype.SetPriority;{};

/**
 * Returns the pivot table condition object.
 * @memberof ApiTop10
 * @returns {PTCondition | null}
 * @since 9.1.0
 */
ApiTop10.prototype.GetPTCondition = ApiFormatCondition.prototype.GetPTCondition;{ return new PTCondition(); };

/**
 * Returns the scope type of the conditional formatting rule.
 * @memberof ApiTop10
 * @returns {XlPivotConditionScope}
 * @since 9.1.0
 */
ApiTop10.prototype.GetScopeType = ApiFormatCondition.prototype.GetScopeType;{ return new XlPivotConditionScope(); };

/**
 * Sets the scope type of the conditional formatting rule.
 * @memberof ApiTop10
 * @param {XlPivotConditionScope} ScopeType - The scope type.
 * @since 9.1.0
 */
ApiTop10.prototype.SetScopeType = ApiFormatCondition.prototype.SetScopeType;{};

/**
 * Returns whether Excel will stop evaluating additional formatting rules if this rule evaluates to True.
 * @memberof ApiTop10
 * @returns {boolean}
 * @since 9.1.0
 */
ApiTop10.prototype.GetStopIfTrue = ApiFormatCondition.prototype.GetStopIfTrue;{ return true; };

/**
 * Sets whether Excel will stop evaluating additional formatting rules if this rule evaluates to True.
 * @memberof ApiTop10
 * @param {boolean} StopIfTrue - True to stop evaluating additional rules.
 * @since 9.1.0
 */
ApiTop10.prototype.SetStopIfTrue = ApiFormatCondition.prototype.SetStopIfTrue;{};

/**
 * Returns the font formatting for the top 10 conditional formatting rule.
 * @memberof ApiTop10
 * @returns {ApiFont}
 * @since 9.1.0
 */
ApiTop10.prototype.GetFont = ApiFormatCondition.prototype.GetFont;{ return new ApiFont(); };

/**
//  * Returns the borders collection for the top 10 conditional formatting rule.
//  * @memberof ApiTop10
//  * @returns {ApiBorders}
//  * @since 9.1.0
//  */
// ApiTop10.prototype.GetBorders = ApiFormatCondition.prototype.GetBorders;{ return new ApiBorders(); };

/**
 * Returns the number format for the top 10 conditional formatting rule.
 * @memberof ApiTop10
 * @returns {string}
 * @since 9.1.0
 */
ApiTop10.prototype.GetNumberFormat = ApiFormatCondition.prototype.GetNumberFormat;{ return ""; };

/**
 * Sets the number format for the top 10 conditional formatting rule.
 * @memberof ApiTop10
 * @param {string} NumberFormat - The number format to apply.
 * @since 9.1.0
 */
ApiTop10.prototype.SetNumberFormat = ApiFormatCondition.prototype.SetNumberFormat;{};

/**
 * Returns the fill color for the top 10 conditional formatting rule.
 * @memberof ApiTop10
 * @returns {ApiColor | null}
 * @since 9.1.0
 */
ApiTop10.prototype.GetFillColor = ApiFormatCondition.prototype.GetFillColor;{ return new ApiColor(); };

/**
 * Sets the fill color for the top 10 conditional formatting rule.
 * @memberof ApiTop10
 * @param {ApiColor} oColor - The fill color to apply.
 * @since 9.1.0
 */
ApiTop10.prototype.SetFillColor = ApiFormatCondition.prototype.SetFillColor;{};

/**
 * Class representing a unique values conditional formatting rule.
 * @constructor
 * @extends ApiFormatCondition
 */
function ApiUniqueValues(rule, range, _parent) {}
ApiUniqueValues.prototype = Object.create(ApiFormatCondition.prototype);
ApiUniqueValues.prototype.constructor = ApiUniqueValues;

/**
 * Returns the duplicate/unique value setting for the unique values conditional formatting rule.
 * @memberof ApiUniqueValues
 * @returns {XlDuplicateValues} The duplicate/unique value setting.
 * @since 9.1.0
 */
ApiUniqueValues.prototype.GetDupeUnique = function() { return new XlDuplicateValues(); };

/**
 * Sets the duplicate/unique value setting for the unique values conditional formatting rule.
 * @memberof ApiUniqueValues
 * @param {XlDuplicateValues} dupeUnique - The duplicate/unique value setting.
 * @since 9.1.0
 */
ApiUniqueValues.prototype.SetDupeUnique = function(dupeUnique) {};

/**
 * Sets the duplicate/unique value setting for the unique values conditional formatting rule.
 * @memberof ApiUniqueValues
 * @param {XlDuplicateValues} dupeUnique - The duplicate/unique value setting.
 * @since 9.1.0
 */
ApiUniqueValues.prototype.DupeUnique = ApiUniqueValues.prototype.SetDupeUnique ();

/**
 * Returns the type of the unique values conditional formatting rule.
 * @memberof ApiUniqueValues
 * @returns {XlFormatConditionType}
 * @since 9.1.0
 */
ApiUniqueValues.prototype.GetType = function() { return new XlFormatConditionType(); };

/**
 * Returns the type of the unique values conditional formatting rule.
 * @memberof ApiUniqueValues
 * @returns {XlFormatConditionType}
 * @since 9.1.0
 */
ApiUniqueValues.prototype.Type = ApiUniqueValues.prototype.GetType ();

/**
 * Deletes the unique values conditional formatting rule.
 * @memberof ApiUniqueValues
 * @since 9.1.0
 */
ApiUniqueValues.prototype.Delete = ApiFormatCondition.prototype.Delete;{};

/**
 * Modifies the range to which this formatting rule applies.
 * @memberof ApiUniqueValues
 * @param {ApiRange} Range - A Range object representing the new range to which the formatting rule will be applied.
 * @since 9.1.0
 */
ApiUniqueValues.prototype.ModifyAppliesToRange = ApiFormatCondition.prototype.ModifyAppliesToRange;{};

/**
 * Sets the priority value for this conditional formatting rule to "1" so that it will be evaluated before all other rules on the worksheet.
 * @memberof ApiUniqueValues
 * @since 9.1.0
 */
ApiUniqueValues.prototype.SetFirstPriority = ApiFormatCondition.prototype.SetFirstPriority;{};

/**
 * Sets the evaluation order for this conditional formatting rule so it is evaluated after all other rules on the worksheet.
 * @memberof ApiUniqueValues
 * @since 9.1.0
 */
ApiUniqueValues.prototype.SetLastPriority = ApiFormatCondition.prototype.SetLastPriority;{};

/**
 * Returns the range to which the conditional formatting rule applies.
 * @memberof ApiUniqueValues
 * @returns {ApiRange}
 * @since 9.1.0
 */
ApiUniqueValues.prototype.GetAppliesTo = ApiFormatCondition.prototype.GetAppliesTo;{ return new ApiRange(); };

/**
 * Returns the parent object for the specified object.
 * @memberof ApiUniqueValues
 * @returns {ApiRange}
 * @since 9.1.0
 */
ApiUniqueValues.prototype.GetParent = ApiFormatCondition.prototype.GetParent;{ return new ApiRange(); };

/**
 * Returns the priority value of the conditional formatting rule.
 * @memberof ApiUniqueValues
 * @returns {number}
 * @since 9.1.0
 */
ApiUniqueValues.prototype.GetPriority = ApiFormatCondition.prototype.GetPriority;{ return 0; };

/**
 * Sets the priority value of the conditional formatting rule.
 * @memberof ApiUniqueValues
 * @param {number} Priority - The priority value (1-based).
 * @since 9.1.0
 */
ApiUniqueValues.prototype.SetPriority = ApiFormatCondition.prototype.SetPriority;{};

/**
 * Returns the pivot table condition object.
 * @memberof ApiUniqueValues
 * @returns {PTCondition | null}
 * @since 9.1.0
 */
ApiUniqueValues.prototype.GetPTCondition = ApiFormatCondition.prototype.GetPTCondition;{ return new PTCondition(); };

/**
 * Returns the scope type of the conditional formatting rule.
 * @memberof ApiUniqueValues
 * @returns {XlPivotConditionScope}
 * @since 9.1.0
 */
ApiUniqueValues.prototype.GetScopeType = ApiFormatCondition.prototype.GetScopeType;{ return new XlPivotConditionScope(); };

/**
 * Sets the scope type of the conditional formatting rule.
 * @memberof ApiUniqueValues
 * @param {XlPivotConditionScope} ScopeType - The scope type.
 * @since 9.1.0
 */
ApiUniqueValues.prototype.SetScopeType = ApiFormatCondition.prototype.SetScopeType;{};

/**
 * Returns whether Excel will stop evaluating additional formatting rules if this rule evaluates to True.
 * @memberof ApiUniqueValues
 * @returns {boolean}
 * @since 9.1.0
 */
ApiUniqueValues.prototype.GetStopIfTrue = ApiFormatCondition.prototype.GetStopIfTrue;{ return true; };

/**
 * Sets whether Excel will stop evaluating additional formatting rules if this rule evaluates to True.
 * @memberof ApiUniqueValues
 * @param {boolean} StopIfTrue - True to stop evaluating additional rules.
 * @since 9.1.0
 */
ApiUniqueValues.prototype.SetStopIfTrue = ApiFormatCondition.prototype.SetStopIfTrue;{};

/**
 * Returns the font formatting for the unique values conditional formatting rule.
 * @memberof ApiUniqueValues
 * @returns {ApiFont}
 * @since 9.1.0
 */
ApiUniqueValues.prototype.GetFont = ApiFormatCondition.prototype.GetFont;{ return new ApiFont(); };

/**
//  * Returns the borders collection for the unique values conditional formatting rule.
//  * @memberof ApiUniqueValues
//  * @returns {ApiBorders}
//  * @since 9.1.0
//  */
// ApiUniqueValues.prototype.GetBorders = ApiFormatCondition.prototype.GetBorders;{ return new ApiBorders(); };

/**
 * Returns the interior (background) formatting for the unique values conditional formatting rule.
 * @memberof ApiUniqueValues
 * @returns {ApiInterior}
 * @since 9.1.0
 */
ApiUniqueValues.prototype.GetInterior = ApiFormatCondition.prototype.GetInterior;{ return new ApiInterior(); };

/**
 * Returns the number format for the unique values conditional formatting rule.
 * @memberof ApiUniqueValues
 * @returns {string}
 * @since 9.1.0
 */
ApiUniqueValues.prototype.GetNumberFormat = ApiFormatCondition.prototype.GetNumberFormat;{ return ""; };

/**
 * Sets the number format for the unique values conditional formatting rule.
 * @memberof ApiUniqueValues
 * @param {string} NumberFormat - The number format to apply.
 * @since 9.1.0
 */
ApiUniqueValues.prototype.SetNumberFormat = ApiFormatCondition.prototype.SetNumberFormat;{};

/**
 * Returns the fill color for the unique values conditional formatting rule.
 * @memberof ApiUniqueValues
 * @returns {ApiColor | null}
 * @since 9.1.0
 */
ApiUniqueValues.prototype.GetFillColor = ApiFormatCondition.prototype.GetFillColor;{ return new ApiColor(); };

/**
 * Sets the fill color for the unique values conditional formatting rule.
 * @memberof ApiUniqueValues
 * @param {ApiColor} oColor - The fill color to apply.
 * @since 9.1.0
 */
ApiUniqueValues.prototype.SetFillColor = ApiFormatCondition.prototype.SetFillColor;{};


