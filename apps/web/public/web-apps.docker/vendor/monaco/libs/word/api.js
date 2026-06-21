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
 * Class representing a continuous region in a document. 
 * Each Range object is determined by the position of the start and end characters.
 * @param oElement - The document element that may be Document, Table, Paragraph, Run or Hyperlink.
 * @param {Number} [Start = undefined] - The start element of Range in the current Element. If omitted or undefined, the range begins at the beginning of the element.
 * @param {Number} [End = undefined] - The end element of Range in the current Element. If omitted or undefined, the range begins at the end of the element.
 * @constructor
 */
function ApiRange(oElement, Start, End){}
ApiRange.prototype.constructor = ApiRange;

/**
 * Returns a type of the ApiRange class.
 * @memberof ApiRange
 * @returns {"range"}
 */
ApiRange.prototype.GetClassType = function(){ return ""; };

/**
 * Returns a paragraph from all the paragraphs that are in the range.
 * @param {Number} nPos - The paragraph position in the range.
 * @returns {ApiParagraph | null} - returns null if position is invalid.
 */
ApiRange.prototype.GetParagraph = function(nPos){ return new ApiParagraph(); };

/**
 * Adds a text to the specified position.
 * @memberof ApiRange
 * @param {String} text - The text that will be added.
 * @param {"after" | "before"} [position = "after"] - The position where the text will be added ("before" or "after" the range specified).
 * @returns {boolean} - returns true if the text was successfully added.
 */
ApiRange.prototype.AddText = function(text, position){ return true; };

/**
 * Adds a bookmark to the specified range.
 * @memberof ApiRange
 * @param {String} sName - The bookmark name.
 * @returns {boolean} - returns false if range is empty.
 */
ApiRange.prototype.AddBookmark = function(sName){ return true; };

/**
 * Adds a hyperlink to the specified range. 
 * @memberof ApiRange
 * @param {string} sLink - The link address.
 * @param {string} sScreenTipText - The screen tip text.
 * @returns {ApiHyperlink | null}  - returns null if range contains more than one paragraph or sLink is invalid. 
 */
ApiRange.prototype.AddHyperlink = function(sLink, sScreenTipText){ return new ApiHyperlink(); };

/**
 * Returns a text from the specified range.
 * @memberof ApiRange
 * @param {object} oPr - The resulting string display properties.
 * @param {boolean} [oPr.Numbering=false] - Defines if the resulting string will include numbering or not.
 * @param {boolean} [oPr.Math=false] - Defines if the resulting string will include mathematical expressions or not.
 * @param {string} [oPr.NewLineSeparator='\r'] - Defines how the line separator will be specified in the resulting string. Any symbol can be used. The default separator is "\r".
 * @param {string} [oPr.TableCellSeparator='\t'] - Defines how the table cell separator will be specified in the resulting string. Any symbol can be used. The default separator is "\t".
 * @param {string} [oPr.TableRowSeparator='\r\n'] - Defines how the table row separator will be specified in the resulting string. Any symbol can be used. The default separator is "\r\n".
 * @param {string} [oPr.ParaSeparator='\r\n'] - Defines how the paragraph separator will be specified in the resulting string. Any symbol can be used. The default separator is "\r\n".
 * @param {string} [oPr.TabSymbol='\t'] - Defines how the tab will be specified in the resulting string (does not apply to numbering). Any symbol can be used. The default symbol is "\t".
 * @returns {String} - returns "" if range is empty.
 */
ApiRange.prototype.GetText = function(oPr){ return ""; };

/**
 * Returns a collection of paragraphs that represents all the paragraphs in the specified range.
 * @memberof ApiRange
 * @returns {ApiParagraph[]}
 */
ApiRange.prototype.GetAllParagraphs = function(){ return [new ApiParagraph()]; };

/**
 * Sets the selection to the specified range.
 * @memberof ApiRange
 * @returns {boolean}
 */
ApiRange.prototype.Select = function(bUpdate){ return true; };

/**
 * Returns a new range that goes beyond the specified range in any direction and spans a different range. The current range has not changed.
 * @memberof ApiRange
 * @param {ApiRange} oRange - The range that will be expanded.
 * @returns {ApiRange | null} - returns null if the specified range can't be expanded. 
 */
ApiRange.prototype.ExpandTo = function(oRange){ return new ApiRange(); };

/**
 * Returns a new range as the intersection of the current range with another range. The current range has not changed.
 * @memberof ApiRange
 * @param {ApiRange} oRange - The range that will be intersected with the current range.
 * @returns {ApiRange | null} - returns null if can't intersect.
 */
ApiRange.prototype.IntersectWith = function(oRange){ return new ApiRange(); };

/**
 * Sets the bold property to the text character.
 * @memberof ApiRange
 * @param {boolean} isBold - Specifies if the Range contents are displayed bold or not.
 * @returns {ApiRange | null} - returns null if can't apply bold.
 */
ApiRange.prototype.SetBold = function(isBold){ return new ApiRange(); };

/**
 * Specifies that any lowercase characters in the current text Range are formatted for display only as their capital letter character equivalents.
 * @memberof ApiRange
 * @param {boolean} isCaps - Specifies if the Range contents are displayed capitalized or not.
 * @returns {ApiRange | null} - returns null if can't apply caps.
 */
ApiRange.prototype.SetCaps = function(isCaps){ return new ApiRange(); };

/**
 * Sets the text color to the current text Range in the RGB format.
 * @memberof ApiRange
 * @param {byte} r - Red color component value.
 * @param {byte} g - Green color component value.
 * @param {byte} b - Blue color component value.
 * @param {boolean} [isAuto=false] - If this parameter is set to "true", then r,g,b parameters will be ignored.
 * @returns {ApiRange | null} - returns null if can't apply color.
 */
ApiRange.prototype.SetColor = function(r, g, b, isAuto){ return new ApiRange(); };

/**
 * Specifies that the contents of the current Range are displayed with two horizontal lines through each character displayed on the line.
 * @memberof ApiRange
 * @param {boolean} isDoubleStrikeout - Specifies if the contents of the current Range are displayed double struck through or not.
 * @returns {ApiRange | null} - returns null if can't apply double strikeout.
 */
ApiRange.prototype.SetDoubleStrikeout = function(isDoubleStrikeout){ return new ApiRange(); };

/**
 * Specifies a highlighting color which is applied as a background to the contents of the current Range.
 * @memberof ApiRange
 * @param {highlightColor} sColor - Available highlight color.
 * @returns {ApiRange | null} - returns null if can't apply highlight.
 */
ApiRange.prototype.SetHighlight = function(sColor){ return new ApiRange(); };

/**
 * Specifies the shading applied to the contents of the current text Range.
 * @memberof ApiRange
 * @param {ShdType} sType - The shading type applied to the contents of the current text Range.
 * @param {byte} r - Red color component value.
 * @param {byte} g - Green color component value.
 * @param {byte} b - Blue color component value.
 * @returns {ApiRange | null} - returns null if can't apply shadow.
 */
ApiRange.prototype.SetShd = function(sType, r, g, b){ return new ApiRange(); };

/**
 * Sets the italic property to the text character.
 * @memberof ApiRange
 * @param {boolean} isItalic - Specifies if the contents of the current Range are displayed italicized or not.
 * @returns {ApiRange | null} - returns null if can't apply italic.
 */
ApiRange.prototype.SetItalic = function(isItalic){ return new ApiRange(); };

/**
 * Specifies that the contents of the current Range are displayed with a single horizontal line through the range center.
 * @memberof ApiRange
 * @param {boolean} isStrikeout - Specifies if the contents of the current Range are displayed struck through or not.
 * @returns {ApiRange | null} - returns null if can't apply strikeout.
 */
ApiRange.prototype.SetStrikeout = function(isStrikeout){ return new ApiRange(); };

/**
 * Specifies that all the lowercase letter characters in the current text Range are formatted for display only as their capital
 * letter character equivalents which are two points smaller than the actual font size specified for this text.
 * @memberof ApiRange
 * @param {boolean} isSmallCaps - Specifies if the contents of the current Range are displayed capitalized two points smaller or not.
 * @returns {ApiRange | null} - returns null if can't apply small caps.
 */
ApiRange.prototype.SetSmallCaps = function(isSmallCaps){ return new ApiRange(); };

/**
 * Sets the text spacing measured in twentieths of a point.
 * @memberof ApiRange
 * @param {twips} nSpacing - The value of the text spacing measured in twentieths of a point (1/1440 of an inch).
 * @returns {ApiRange | null} - returns null if can't apply spacing.
 */
ApiRange.prototype.SetSpacing = function(nSpacing){ return new ApiRange(); };

/**
 * Specifies that the contents of the current Range are displayed along with a line appearing directly below the character
 * (less than all the spacing above and below the characters on the line).
 * @memberof ApiRange
 * @param {boolean} isUnderline - Specifies if the contents of the current Range are displayed underlined or not.
 * @returns {ApiRange | null} - returns null if can't apply underline.
 */
ApiRange.prototype.SetUnderline = function(isUnderline){ return new ApiRange(); };

/**
 * Specifies the alignment which will be applied to the Range contents in relation to the default appearance of the Range text:
 * <b>"baseline"</b> - the characters in the current text Range will be aligned by the default text baseline.
 * <b>"subscript"</b> - the characters in the current text Range will be aligned below the default text baseline.
 * <b>"superscript"</b> - the characters in the current text Range will be aligned above the default text baseline.
 * @memberof ApiRange
 * @param {("baseline" | "subscript" | "superscript")} sType - The vertical alignment type applied to the text contents.
 * @returns {ApiRange | null} - returns null if can't apply align.
 */
ApiRange.prototype.SetVertAlign = function(sType){ return new ApiRange(); };

/**
 * Specifies the amount by which text is raised or lowered for the current Range in relation to the default
 * baseline of the surrounding non-positioned text.
 * @memberof ApiRange
 * @param {hps} nPosition - Specifies a positive (raised text) or negative (lowered text)
 * measurement in half-points (1/144 of an inch).
 * @returns {ApiRange | null} - returns null if can't set position.
 */
ApiRange.prototype.SetPosition = function(nPosition){ return new ApiRange(); };

/**
 * Sets the font size to the characters of the current text Range.
 * @memberof ApiRange
 * @param {hps} FontSize - The text size value measured in half-points (1/144 of an inch).
 * @returns {ApiRange | null} - returns null if can't set font size.
 */
ApiRange.prototype.SetFontSize = function(FontSize){ return new ApiRange(); };

/**
 * Sets all 4 font slots with the specified font family.
 * @memberof ApiRange
 * @param {string} sFontFamily - The font family or families used for the current text Range.
 * @returns {ApiRange | null} - returns null if can't set font family.
 */
ApiRange.prototype.SetFontFamily = function(sFontFamily){ return new ApiRange(); };

/**
 * Sets the style to the current Range.
 * @memberof ApiRange
 * @param {ApiStyle} oStyle - The style which must be applied to the text character.
 * @returns {ApiRange | null} - returns null if can't set style.
 */
ApiRange.prototype.SetStyle = function(oStyle){ return new ApiRange(); };

/**
 * Sets the text properties to the current Range.
 * @memberof ApiRange
 * @param {ApiTextPr} oTextPr - The text properties that will be applied to the current range.
 * @returns {ApiRange | null} - returns null if can't set text properties.
 */
ApiRange.prototype.SetTextPr = function(oTextPr){ return new ApiRange(); };

/**
 * Returns the merged text properties of the entire range.
 * @memberof ApiRange
 * @returns {ApiTextPr}
 * @since 8.2.0
 */
ApiRange.prototype.GetTextPr = function(){ return new ApiTextPr(); };

/**
 * Deletes all the contents from the current range.
 * @memberof ApiRange
 * @returns {boolean} - returns false if range is empty.
 */
ApiRange.prototype.Delete = function(){ return true; };

/**
 * Converts the ApiRange object into the JSON object.
 * @memberof ApiRange
 * @param {boolean} bWriteNumberings - Specifies if the used numberings will be written to the JSON object or not.
 * @param {boolean} bWriteStyles - Specifies if the used styles will be written to the JSON object or not.
 * @returns {JSON}
 */
ApiRange.prototype.ToJSON = function(bWriteNumberings, bWriteStyles){ return new JSON(); };

/**
 * Adds a comment to the current range.
 * @memberof ApiRange
 * @param {string} sText - The comment text.
 * @param {string} [sAuthor] - The author's name.
 * @param {string} [sUserId] - The user ID of the comment author.
 * @returns {ApiComment} - Returns null if the comment was not added.
 */
ApiRange.prototype.AddComment = function(sText, sAuthor, sUserId){ return new ApiComment(); };

/**
 * Returns a Range object that represents the document part contained in the specified range.
 * @param {Number} [Start=0] - Start position index in the current range.
 * @param {Number} [End=-1] - End position index in the current range (if <= 0, then the range is taken to the end).
 * @returns {ApiRange}
 */
ApiRange.prototype.GetRange = function(nStart, nEnd){ return new ApiRange(); };

/**
 * Returns the start page number of the current range.
 * @memberof ApiRange
 * @returns {Number}
 * @since 8.2.0
 */
ApiRange.prototype.GetStartPage = function(){ return 0; };

/**
 * Returns the end page number of the current range.
 * @memberof ApiRange
 * @returns {Number}
 * @since 8.2.0
 */
ApiRange.prototype.GetEndPage = function(){ return 0; };

/**
 * Sets the start position of the current range object.
 * @memberof ApiRange
 * @param {Number} nPos - Start position.
 * @returns {boolean}
 * @since 8.2.0
 */
ApiRange.prototype.SetStartPos = function(nPos){ return true; };

/**
 * Sets the end position of the current range object.
 * @memberof ApiRange
 * @param {Number} nPos - End position.
 * @returns {boolean}
 * @since 8.2.0
 */
ApiRange.prototype.SetEndPos = function(nPos){ return true; };

/**
 * Returns the start position of the current range.
 * @memberof ApiRange
 * @returns {number}
 * @since 8.2.0
 */
ApiRange.prototype.GetStartPos = function() { return 0; };

/**
 * Returns the start position of the current range.
 * @memberof ApiRange
 * @returns {number}
 * @since 8.2.0
 */
ApiRange.prototype.Start = ApiRange.prototype.GetStartPos ();

/**
 * Returns the end position of the current range.
 * @memberof ApiRange
 * @returns {number}
 * @since 8.2.0
 */
ApiRange.prototype.GetEndPos = function() { return 0; };

/**
 * Returns the end position of the current range.
 * @memberof ApiRange
 * @returns {number}
 * @since 8.2.0
 */
ApiRange.prototype.End = ApiRange.prototype.GetEndPos ();

/**
 * Moves a cursor to a specified position of the current range object.
 * If there is any selection in the document, it will be removed.
 * @memberof ApiRange
 * @param {number} [nPos=0] - The desired cursor position.
 * @returns {boolean}
 * @since 9.0.0
 */
ApiRange.prototype.MoveCursorToPos = function(nPos){ return true; };

/**
 * Adds a field to the specified range by the field instruction code.
 * <note> This method removes text within a range. </note>
 * @memberof ApiRange
 * @param {string} sCode - The field instruction code.
 * @returns {boolean}
 * @since 9.0.0
 */
ApiRange.prototype.AddField = function(sCode) { return true; };

/**
 * Class representing a document.
 * @constructor
 * @extends {ApiDocumentContent}
 */
function ApiDocument(Document){}
ApiDocument.prototype = Object.create(ApiDocumentContent.prototype);
ApiDocument.prototype.constructor = ApiDocument;

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
 * Class representing a table.
 * @constructor
 * @extends {ApiTablePr}
 */
function ApiTable(Table){}
ApiTable.prototype = Object.create(ApiTablePr.prototype);
ApiTable.prototype.constructor = ApiTable;

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
 * Class representing a comment.
 * @constructor
 */
function ApiComment(oComment){}

/**
 * Class representing a comment reply.
 * @constructor
 */
function ApiCommentReply(oParentComm, oCommentReply){}

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
 * Class representing a document form base.
 * @constructor
 */
function ApiFormBase(oSdt){}

/**
 * Class representing a document text field.
 * @constructor
 * @extends {ApiFormBase}
 */
function ApiTextForm(oSdt){}
ApiTextForm.prototype = Object.create(ApiFormBase.prototype);
ApiTextForm.prototype.constructor = ApiTextForm;

/**
 * Class representing a document combo box / drop-down list.
 * @constructor
 * @extends {ApiFormBase}
 */
function ApiComboBoxForm(oSdt){}
ApiComboBoxForm.prototype = Object.create(ApiFormBase.prototype);
ApiComboBoxForm.prototype.constructor = ApiComboBoxForm;

/**
 * Class representing a document checkbox / radio button.
 * @constructor
 * @extends {ApiFormBase}
 */
function ApiCheckBoxForm(oSdt){}
ApiCheckBoxForm.prototype = Object.create(ApiFormBase.prototype);
ApiCheckBoxForm.prototype.constructor = ApiCheckBoxForm;

/**
 * Class representing a document picture form.
 * @constructor
 * @extends {ApiFormBase}
 */
function ApiPictureForm(oSdt){}
ApiPictureForm.prototype = Object.create(ApiFormBase.prototype);
ApiPictureForm.prototype.constructor = ApiPictureForm;

/**
 * Class representing a document date field.
 * @constructor
 * @extends {ApiFormBase}
 */
function ApiDateForm(oSdt){}
ApiDateForm.prototype = Object.create(ApiFormBase.prototype);
ApiDateForm.prototype.constructor = ApiDateForm;

/**
 * Class representing a complex field.
 * @param oSdt
 * @constructor
 * @extends {ApiFormBase}
 */
function ApiComplexForm(oSdt){}
ApiComplexForm.prototype = Object.create(ApiFormBase.prototype);
ApiComplexForm.prototype.constructor = ApiComplexForm;

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
 * Returns a Range object that represents the document part contained in the specified hyperlink.
 * @param {Number} Start - Start position index in the current element.
 * @param {Number} End - End position index in the current element.
 * @returns {ApiRange} 
 */
ApiHyperlink.prototype.GetRange = function(Start, End){ return new ApiRange(); };

/**
 * Converts the ApiHyperlink object into the JSON object.
 * @memberof ApiHyperlink
 * @param {boolean} bWriteStyles - Specifies if the used styles will be written to the JSON object or not.
 * @returns {JSON}
 */
ApiHyperlink.prototype.ToJSON = function(bWriteStyles){ return new JSON(); };

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
 * Class representing a table row.
 * @constructor
 * @extends {ApiTableRowPr}
 */
function ApiTableRow(Row){}
ApiTableRow.prototype = Object.create(ApiTableRowPr.prototype);
ApiTableRow.prototype.constructor = ApiTableRow;

/**
 * Class representing the table cell properties.
 * @constructor
 */
function ApiTableCellPr(Parent, CellPr){}

/**
 * Class representing a table cell.
 * @constructor
 * @extends {ApiTableCellPr}
 */
function ApiTableCell(Cell){}
ApiTableCell.prototype = Object.create(ApiTableCellPr.prototype);
ApiTableCell.prototype.constructor = ApiTableCell;

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
 * Class representing a graphical object.
 * @constructor
 */
function ApiDrawing(Drawing){}

/**
 * Class representing an image.
 * @constructor
 */
function ApiImage(Image){}
ApiImage.prototype = Object.create(ApiDrawing.prototype);
ApiImage.prototype.constructor = ApiImage;

/**
 * Class representing an Ole object.
 * @constructor
 */
function ApiOleObject(OleObject){}
ApiOleObject.prototype = Object.create(ApiDrawing.prototype);
ApiOleObject.prototype.constructor = ApiOleObject;

/**
 * Class representing a shape.
 * @constructor
 */
function ApiShape(Shape){}
ApiShape.prototype = Object.create(ApiDrawing.prototype);
ApiShape.prototype.constructor = ApiShape;

/**
 * Class representing a chart.
 * @constructor
 *
 */
function ApiChart(Chart){}
ApiChart.prototype = Object.create(ApiDrawing.prototype);
ApiChart.prototype.constructor = ApiChart;

/**
 * Class representing a group of drawings.
 * @constructor
 */
function ApiGroup(oGroup){}
ApiGroup.prototype = Object.create(ApiDrawing.prototype);
ApiGroup.prototype.constructor = ApiGroup;

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
 * Returns the main document.
 * @memberof ApiInterface
 * @returns {ApiDocument}
 */
ApiInterface.prototype.GetDocument = function(){ return new ApiDocument(); };

/**
 * Returns the object by it's internal ID.
 * @memberof ApiInterface
 * @param id {string} ID of the object.
 * @returns {object}
 * @since 9.0.4
 */
ApiInterface.prototype.GetByInternalId = function(id){ return new object(); };

/**
 * Creates a new paragraph.
 * @memberof ApiInterface
 * @returns {ApiParagraph}
 */
ApiInterface.prototype.CreateParagraph = function(){ return new ApiParagraph(); };

/**
 * Creates an element range.
 * If you do not specify the start and end positions, the range will be taken from the entire element.
 * @memberof ApiInterface
 * @param element - The element from which the range will be taken.
 * @param start - Start range position.
 * @param end - End range position.
 * @returns {ApiRange | null} - returns null if element isn't supported.
 */
ApiInterface.prototype.CreateRange = function(element, start, end){ return new ApiRange(); };

/**
 * Creates a new table with a specified number of rows and columns.
 * @memberof ApiInterface
 * @param {number} cols - Number of columns.
 * @param {number} rows - Number of rows.
 * @returns {ApiTable}
 */
ApiInterface.prototype.CreateTable = function(cols, rows){ return new ApiTable(); };

/**
 * Creates a new smaller text block to be inserted to the current paragraph or table.
 * @memberof ApiInterface
 * @returns {ApiRun}
 */
ApiInterface.prototype.CreateRun = function(){ return new ApiRun(); };

/**
 * Creates a new hyperlink text block to be inserted to the current paragraph or table.
 * @memberof ApiInterface
 * @param {string} link - The hyperlink address.
 * @param {string} display - The text to display the hyperlink.
 * @param {string} screenTipText - The screen tip text.
 * @returns {ApiHyperlink}
 */
ApiInterface.prototype.CreateHyperlink = function(link, display, screenTipText){ return new ApiHyperlink(); };

/**
 * Creates an image with the parameters specified.
 * @memberof ApiInterface
 * @param {string} imageSrc - The image source where the image to be inserted should be taken from (currently only internet URL or Base64 encoded images are supported).
 * @param {EMU} width - The image width in English measure units.
 * @param {EMU} height - The image height in English measure units.
 * @returns {ApiImage}
 */
ApiInterface.prototype.CreateImage = function(imageSrc, width, height){ return new ApiImage(); };

/**
 * Creates a shape with the parameters specified.
 * @memberof ApiInterface
 * @param {ShapeType} [shapeType="rect"] - The shape type which specifies the preset shape geometry.
 * @param {EMU} [width = 914400] - The shape width in English measure units.
 * @param {EMU} [height = 914400] - The shape height in English measure units.
 * @param {ApiFill} [fill = Api.CreateNoFill()] - The color or pattern used to fill the shape.
 * @param {ApiStroke} [stroke = Api.CreateStroke(0, Api.CreateNoFill())] - The stroke used to create the element shadow.
 * @returns {ApiShape}
 */
ApiInterface.prototype.CreateShape = function(shapeType, width, height, fill, stroke){ return new ApiShape(); };

/**
 * Groups an array of drawings.
 * @memberof ApiInterface
 * @param {DrawingForGroup[]} drawings - An array of drawings to group.
 * @returns {ApiGroup}
 * @since 8.3.0
 */
ApiInterface.prototype.CreateGroup = function(drawings){ return new ApiGroup(); };

/**
 * Creates a chart with the parameters specified.
 * @memberof ApiInterface
 * @param {ChartType} [chartType="bar"] - The chart type used for the chart display.
 * @param {number[][]} series - The array of the data used to build the chart from.
 * @param {number[] | string[]} seriesNames - The array of the names (the source table column names) used for the data which the chart will be build from.
 * @param {number[] | string[]} catNames - The array of the names (the source table row names) used for the data which the chart will be build from.
 * @param {EMU} width - The chart width in English measure units.
 * @param {EMU} height - The chart height in English measure units.
 * @param {number} styleIndex - The chart color style index (can be 1 - 48, as described in OOXML specification).
 * @param {NumFormat[] | String[]} numFormats - Numeric formats which will be applied to the series (can be custom formats).
 * The default numeric format is "General".
 * @returns {ApiChart}
 */
ApiInterface.prototype.CreateChart = function(chartType, series, seriesNames, catNames, width, height, styleIndex, numFormats){ return new ApiChart(); };

/**
 * Creates an OLE object with the parameters specified.
 * @memberof ApiInterface
 * @param {string} imageSrc - The image source where the image to be inserted should be taken from (currently, only internet URL or Base64 encoded images are supported).
 * @param {EMU} width - The OLE object width in English measure units.
 * @param {EMU} height - The OLE object height in English measure units.
 * @param {string} data - The OLE object string data.
 * @param {string} appId - The application ID associated with the current OLE object.
 * @returns {ApiOleObject}
 */
ApiInterface.prototype.CreateOleObject = function(imageSrc, width, height, data, appId){ return new ApiOleObject(); };

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
 * Creates a new inline container.
 * @memberof ApiInterface
 * @returns {ApiInlineLvlSdt}
 */
ApiInterface.prototype.CreateInlineLvlSdt = function(){ return new ApiInlineLvlSdt(); };

/**
 * The checkbox content control properties
 * @typedef {Object} ContentControlCheckBoxPr
 * @property {boolean} [checked] Indicates whether the checkbox is checked by default.
 * @property {string} [checkedSymbol] A custom symbol to display when the checkbox is checked (e.g., "☒").
 * @property {string} [uncheckedSymbol] A custom symbol to display when the checkbox is unchecked (e.g., "☐").
 */

/**
 * Creates a checkbox content control.
 * @memberof ApiInterface
 * @since 9.0.0
 * @param {ContentControlCheckBoxPr} checkBoxPr The configuration object with the checkbox properties.
 * @returns {ApiInlineLvlSdt} An inline-level content control that represents a checkbox.
 */
ApiInterface.prototype.CreateCheckBoxContentControl = function(checkBoxPr){ return new ApiInlineLvlSdt(); };

/**
 * Creates a new picture container.
 * @memberof ApiInterface
 * @since 9.0.0
 * @param {EMU} [width] - The optional image width.
 * @param {EMU} [height] - The optional image height.
 * @returns {ApiInlineLvlSdt} An inline-level content control that represents a picture container.
 */
ApiInterface.prototype.CreatePictureContentControl = function(width, height){ return new ApiInlineLvlSdt(); };

/**
 * The object representing the items in the combo box or drop-down list.
 * @typedef {Object} ContentControlListItem
 * @property {string} display - The text to be displayed in the combo box or drop-down list.
 * @property {string} value - The value associated with the item.
 */

/**
 * Creates a new combo box container with the given list of options.
 * @memberof ApiInterface
 * @since 9.0.0
 * @param {ContentControlListItem[]} [list] - An array of objects representing the items in the combo box.
 * @param {number} [selected=-1] - The selected item index.
 * @returns {ApiInlineLvlSdt} An inline-level content control that represents a combo box.
 */
ApiInterface.prototype.CreateComboBoxContentControl = function(list, selected){ return new ApiInlineLvlSdt(); };

/**
 * Creates a new drop-down list container with the given list of options.
 * @memberof ApiInterface
 * @since 9.0.0
 * @param {ContentControlListItem[]} [list] - An array of objects representing the items in the drop-down list.
 * @param {number} [selected=-1] - The selected item index.
 * @returns {ApiInlineLvlSdt} An inline-level content control that represents a drop-down list.
 */
ApiInterface.prototype.CreateDropDownListContentControl = function(list, selected){ return new ApiInlineLvlSdt(); };

/**
 * The date picker content control properties.
 * @typedef {Object} ContentControlDatePr
 * @property {string} format - The date format. Example: "mm.dd.yyyy".
 * @property {string} lang   - The date language. Possible value for this parameter is a language identifier as defined by
 * RFC 4646/BCP 47. Example: "en-CA".
 */

/**
 * Creates a new date picker content control.
 * @memberof ApiInterface
 * @since 9.0.0
 * @param {ContentControlDatePr} [datePickerPr] - The optional date picker properties.
 * @returns {ApiInlineLvlSdt} An inline-level content control that represents a date-time picker.
 */
ApiInterface.prototype.CreateDatePickerContentControl = function(datePickerPr){ return new ApiInlineLvlSdt(); };

/**
 * Creates a new block level container.
 * @memberof ApiInterface
 * @returns {ApiBlockLvlSdt}
 */
ApiInterface.prototype.CreateBlockLvlSdt = function(){ return new ApiBlockLvlSdt(); };

/**
 * Saves changes to the specified document.
 * @memberof ApiInterface
 * @returns {boolean}
 */
ApiInterface.prototype.Save = function(){ return true; };

/**
 * Loads data for the mail merge. 
 * @memberof ApiInterface
 * @param {String[][]} data - Mail merge data. The first element of the array is the array with names of the merge fields.
 * The rest of the array elements are arrays with values for the merge fields.
 * @returns {boolean}
 */
ApiInterface.prototype.LoadMailMergeData = function(data){ return true; };

/**
 * Returns the mail merge template document.
 * @memberof ApiInterface
 * @returns {ApiDocumentContent}  
 */
ApiInterface.prototype.GetMailMergeTemplateDocContent = function(){ return new ApiDocumentContent(); };

/**
 * Returns the mail merge receptions count.
 * @memberof ApiInterface
 * @returns {number}  
 */
ApiInterface.prototype.GetMailMergeReceptionsCount = function(){ return 0; };

/**
 * Replaces the main document content with another document content.
 * @memberof ApiInterface
 * @param {ApiDocumentContent} documentContent - The document content which the main document content will be replaced with.
 * @returns {boolean}
 */
ApiInterface.prototype.ReplaceDocumentContent = function(documentContent){ return true; };

/**
 * Starts the mail merge process.
 * @memberof ApiInterface
 * @param {number} [startIndex=0] - The start index of the document for mail merge process.
 * @param {number} [endIndex=Api.GetMailMergeReceptionsCount() - 1] - The end index of the document for mail merge process.
 * @returns {boolean}
 */
ApiInterface.prototype.MailMerge = function(startIndex, endIndex){ return true; };

/**
 * Converts the specified JSON object into the Document Builder object of the corresponding type.
 * @memberof ApiInterface
 * @param {JSON} message - The JSON object to convert.
 * @returns {object} - readed api class element
 */
ApiInterface.prototype.FromJSON = function(message){ return new object(); };

/**
 * Returns a type of the ApiUnsupported class.
 * @returns {"unsupported"}
 */
ApiUnsupported.prototype.GetClassType = function(){ return ""; };

/**
 * Adds a comment to the specifed document element or array of Runs.
 * @memberof ApiInterface
 * @param {ApiRun[] | DocumentElement} element - The element where the comment will be added. It may be applied to any element which has the *AddComment* method.
 * @param {string} text - The comment text.
 * @param {string} [author] - The author's name.
 * @param {string} [userId] - The user ID of the comment author.
 * @returns {ApiComment} - Returns null if the comment was not added.
 */
ApiInterface.prototype.AddComment = function(element, text, author, userId){ return new ApiComment(); };

/**
 * Subscribes to the specified event and calls the callback function when the event fires.
 * @function
 * @memberof ApiInterface
 * @param {string} eventName - The event name.
 * @param {function} callback - Function to be called when the event fires.
 * @returns {boolean}
 */
ApiInterface.prototype["attachEvent"] = ApiInterface.prototype.attachEvent;{ return true; };

/**
 * Unsubscribes from the specified event.
 * @function
 * @memberof ApiInterface
 * @param {string} eventName - The event name.
 * @returns {boolean}
 */
ApiInterface.prototype["detachEvent"] = ApiInterface.prototype.detachEvent;{ return true; };

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
 * Returns a Range object that represents the part of the document contained in the document content.
 * @memberof ApiDocumentContent
 * @param {Number} Start - Start position index in the current element.
 * @param {Number} End - End position index in the current element.
 * @returns {ApiRange} 
 */
ApiDocumentContent.prototype.GetRange = function(Start, End){ return new ApiRange(); };

/**
 * Converts the ApiDocumentContent object into the JSON object.
 * @memberof ApiDocumentContent
 * @param {boolean} isWriteNumberings - Specifies if the used numberings will be written to the JSON object or not.
 * @param {boolean} isWriteStyles - Specifies if the used styles will be written to the JSON object or not.
 * @returns {JSON}
 */
ApiDocumentContent.prototype.ToJSON = function(isWriteNumberings, isWriteStyles){ return new JSON(); };

/**
 * Returns an array of document elements from the current ApiDocumentContent object.
 * @memberof ApiDocumentContent
 * @param {boolean} bGetCopies - Specifies if the copies of the document elements will be returned or not.
 * @returns {DocumentElement[]}
 */
ApiDocumentContent.prototype.GetContent = function(bGetCopies){ return [new DocumentElement()]; };

/**
 * Returns a collection of drawing objects from the document content.
 * @memberof ApiDocumentContent
 * @returns {Drawing[]}  
 */
ApiDocumentContent.prototype.GetAllDrawingObjects = function(){ return [new Drawing()]; };

/**
 * Returns a collection of shape objects from the document content.
 * @memberof ApiDocumentContent
 * @returns {ApiShape[]}  
 */
ApiDocumentContent.prototype.GetAllShapes = function(){ return [new ApiShape()]; };

/**
 * Returns a collection of image objects from the document content.
 * @memberof ApiDocumentContent
 * @returns {ApiImage[]}  
 */
ApiDocumentContent.prototype.GetAllImages = function(){ return [new ApiImage()]; };

/**
 * Returns a collection of chart objects from the document content.
 * @memberof ApiDocumentContent
 * @returns {ApiChart[]}  
 */
ApiDocumentContent.prototype.GetAllCharts = function(){ return [new ApiChart()]; };

/**
 * Returns a collection of OLE objects from the document content.
 * @memberof ApiDocumentContent
 * @returns {ApiOleObject[]}  
 */
ApiDocumentContent.prototype.GetAllOleObjects = function(){ return [new ApiOleObject()]; };

/**
 * Returns an array of all paragraphs from the current document content.
 * @memberof ApiDocumentContent
 * @returns {ApiParagraph[]}
 */
ApiDocumentContent.prototype.GetAllParagraphs = function(){ return [new ApiParagraph()]; };

/**
 * Returns an array of all tables from the current document content.
 * @memberof ApiDocumentContent
 * @returns {ApiTable[]}
 */
ApiDocumentContent.prototype.GetAllTables = function(){ return [new ApiTable()]; };

/**
 * Returns the inner text of the current document content object.
 * @memberof ApiDocumentContent
 * @param {object} oProps - The resulting string display properties.
 * @param {boolean} oProps.Numbering - Defines if the resulting string will include numbering or not.
 * @param {boolean} oProps.Math - Defines if the resulting string will include mathematical expressions or not.
 * @param {string} [oProps.TableCellSeparator='\t'] - Defines how the table cell separator will be specified in the resulting string. Any symbol can be used. The default separator is "\t".
 * @param {string} [oProps.TableRowSeparator='\r\n'] - Defines how the table row separator will be specified in the resulting string. Any symbol can be used. The default separator is "\r\n".
 * @param {string} [oProps.ParaSeparator='\r\n'] - Defines how the paragraph separator will be specified in the resulting string. Any symbol can be used. The default separator is "\r\n".
 * @param {string} [oProps.TabSymbol='\t'] - Defines how the tab will be specified in the resulting string. Any symbol can be used. The default symbol is "\t".
 * @param {string} [oProps.NewLineSeparator='\r'] - Defines how the line separator will be specified in the resulting string. Any symbol can be used. The default separator is "\r".
 * @returns {string}
 * @since 8.3.0
 */
ApiDocumentContent.prototype.GetText = function(oProps){ return ""; };

/**
 * Returns the current paragraph where the cursor is located.
 * @memberof ApiDocumentContent
 * @returns {ApiParagraph}
 * @since 9.0.0
 */
ApiDocumentContent.prototype.GetCurrentParagraph = function(){ return new ApiParagraph(); };

/**
 * Returns the current run where the cursor is located.
 * @memberof ApiDocumentContent
 * @returns {ApiRun}
 * @since 9.0.0
 */
ApiDocumentContent.prototype.GetCurrentRun = function(){ return new ApiRun(); };

/**
 * Returns the currently selected content control.
 * @memberof ApiDocumentContent
 * @since 9.0.0
 * @returns {ApiBlockLvlSdt | ApiInlineLvlSdt | null}
 */
ApiDocumentContent.prototype.GetCurrentContentControl = function(){ return new ApiBlockLvlSdt(); };

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
 * Returns a type of the ApiDocument class.
 * @memberof ApiDocument
 * @returns {"document"}
 */
ApiDocument.prototype.GetClassType = function(){ return ""; };

/**
 * Creates a new history point.
 * @memberof ApiDocument
 * @returns {boolean}
 */
ApiDocument.prototype.CreateNewHistoryPoint = function(){ return true; };

/**
 * Returns a style by its name.
 * @memberof ApiDocument
 * @param {string} sStyleName - The style name.
 * @returns {ApiStyle}
 */
ApiDocument.prototype.GetStyle = function(sStyleName){ return new ApiStyle(); };

/**
 * Creates a new style with the specified type and name. If there is a style with the same name it will be replaced with a new one.
 * @memberof ApiDocument
 * @param {string} sStyleName - The name of the style which will be created.
 * @param {StyleType} [sType="paragraph"] - The document element which the style will be applied to.
 * @returns {ApiStyle}
 */
ApiDocument.prototype.CreateStyle = function(sStyleName, sType){ return new ApiStyle(); };

/**
 * Returns the default style parameters for the specified document element.
 * @memberof ApiDocument
 * @param {StyleType} sStyleType - The document element which we want to get the style for.
 * @returns {ApiStyle}
 */
ApiDocument.prototype.GetDefaultStyle = function(sStyleType){ return new ApiStyle(); };

/**
 * Returns a set of default properties for the text run in the current document.
 * @memberof ApiDocument
 * @returns {ApiTextPr}
 */
ApiDocument.prototype.GetDefaultTextPr = function(){ return new ApiTextPr(); };

/**
 * Returns a set of default paragraph properties in the current document.
 * @memberof ApiDocument
 * @returns {ApiParaPr}
 */
ApiDocument.prototype.GetDefaultParaPr = function(){ return new ApiParaPr(); };

/**
 * Returns the document final section.
 * @memberof ApiDocument
 * @returns {ApiSection}
 */
ApiDocument.prototype.GetFinalSection = function(){ return new ApiSection(); };

/**
 * Creates a new document section which ends at the specified paragraph. Allows to set local parameters to the current
 * section - page size, footer, header, columns, etc.
 * @memberof ApiDocument
 * @param {ApiParagraph} oParagraph - The paragraph after which a new document section will be inserted.
 * Paragraph must be in a document.
 * @returns {ApiSection | null} Returns null if parametr is invalid.
 */
ApiDocument.prototype.CreateSection = function(oParagraph){ return new ApiSection(); };

/**
 * Specifies whether sections in this document will have different headers and footers for even and
 * odd pages (one header/footer for odd pages and another header/footer for even pages).
 * @memberof ApiDocument
 * @param {boolean} isEvenAndOdd - If true the header/footer will be different for odd and even pages, if false they will be the same.
 * @returns {boolean}
 */
ApiDocument.prototype.SetEvenAndOddHdrFtr = function(isEvenAndOdd){ return true; };

/**
 * Creates an abstract multilevel numbering with a specified type.
 * @memberof ApiDocument
 * @param {("bullet" | "numbered")} [sType="bullet"] - The type of the numbering which will be created.
 * @returns {ApiNumbering}
 */
ApiDocument.prototype.CreateNumbering = function(sType){ return new ApiNumbering(); };

/**
 * Inserts an array of elements into the current position of the document.
 * @memberof ApiDocument
 * @param {DocumentElement[]} arrContent - An array of elements to insert.
 * @param {boolean} [isInline=false] - Inline insert or not (works only for the last and the first element and only if it's a paragraph).
 * @param {object} [oPr=undefined] - Specifies that text and paragraph document properties are preserved for the inserted elements. 
 * The object should look like this: {"KeepTextOnly": true}. 
 * @returns {boolean} Success?
 */
ApiDocument.prototype.InsertContent = function(arrContent, isInline, oPr){ return true; };

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
 * Returns a report about all the comments added to the document.
 * @memberof ApiDocument
 * @returns {CommentReport}
 */
ApiDocument.prototype.GetCommentsReport = function(){ return new CommentReport(); };

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
 * Returns a report about every change which was made to the document in the review mode.
 * @memberof ApiDocument
 * @returns {ReviewReport}
 */
ApiDocument.prototype.GetReviewReport = function(){ return new ReviewReport(); };

/**
 * Finds and replaces the text.
 * @memberof ApiDocument
 * @param {Object} oProperties - The properties to find and replace.
 * @param {string} oProperties.searchString - Search string.
 * @param {string} oProperties.replaceString - Replacement string.
 * @param {string} [oProperties.matchCase=true] - Case sensitive or not.
 * @returns {boolean}
 */
ApiDocument.prototype.SearchAndReplace = function(oProperties){ return true; };

/**
 * Returns a list of all the content controls from the document.
 * @memberof ApiDocument
 * @returns {ApiBlockLvlSdt[] | ApiInlineLvlSdt[]}
 */
ApiDocument.prototype.GetAllContentControls = function(){ return [new ApiBlockLvlSdt()]; };

/**
 * Returns a list of all tags that are used for all content controls in the document.
 * @memberof ApiDocument
 * @returns {String[]}
 */
ApiDocument.prototype.GetTagsOfAllContentControls = function(){ return [""]; };

/**
 * Returns a list of all tags that are used for all forms in the document.
 * @memberof ApiDocument
 * @returns {String[]}
 */
ApiDocument.prototype.GetTagsOfAllForms = function(){ return [""]; };

/**
 * Returns a list of all content controls in the document with the specified tag name.
 * @memberof ApiDocument
 * @param sTag {string} - Content control tag.
 * @returns {ApiBlockLvlSdt[] | ApiInlineLvlSdt[]}
 */
ApiDocument.prototype.GetContentControlsByTag = function(sTag){ return [new ApiBlockLvlSdt()]; };

/**
 * Returns a list of all forms in the document with the specified tag name.
 * @memberof ApiDocument
 * @param sTag {string} - Form tag.
 * @returns {ApiForm[]}
 */
ApiDocument.prototype.GetFormsByTag = function(sTag){ return [new ApiForm()]; };

/**
 * Returns a list of all forms in the document with the specified role name.
 * @memberof ApiDocument
 * @param role {string} - The form role.
 * @returns {ApiForm[]}
 * @since 9.0.0
 */
ApiDocument.prototype.GetFormsByRole = function(role){ return [new ApiForm()]; };

/**
 * Returns a list of all forms in the document with the specified key.
 * @memberof ApiDocument
 * @param key {string} - The form key.
 * @returns {ApiForm[]}
 * @since 9.0.0
 */
ApiDocument.prototype.GetFormsByKey = function(key){ return [new ApiForm()]; };

/**
 * Returns a list of all form keys attached to the specified role.
 * @memberof ApiDocument
 * @param role {string} - The form role.
 * @returns {string[]} - A list of all form keys attached to the specified role.
 * @since 9.0.0
 */
ApiDocument.prototype.GetFormKeysByRole = function(role){ return [""]; };

/**
 * Returns the form value for the specified key. For a group of radio buttons returns Choice, i.e. the name of the selected item.
 * @memberof ApiDocument
 * @param key {string} - The form key.
 * @returns {null | boolean | string} Returns true/false for checkboxes and string for other form types. Returns null if
 * there is no form with the specified key.
 * @since 9.0.0
 */
ApiDocument.prototype.GetFormValueByKey = function(key){ return null; };

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
 * Returns the data from all forms present in the current document.
 * If a form was created and not assigned to any part of the document, it won't appear in this list.
 * @memberof ApiDocument
 * @returns {Array.<FormData>}
 * @since 8.0.0
 */
ApiDocument.prototype.GetFormsData = function(){ return []; };

/**
 * Sets the data to the specified forms.
 * @memberof ApiDocument
 * @param {Array.<FormData>} arrData - An array of form data to set to the specified forms.
 * @returns {boolean}
 * @since 8.0.0
 */
ApiDocument.prototype.SetFormsData = function(arrData){ return true; };

/**
 * Sets the change tracking mode.
 * @memberof ApiDocument
 * @param isTrack {boolean} - Specifies if the change tracking mode is set or not.
 * @returns {boolean}
 */
ApiDocument.prototype.SetTrackRevisions = function(isTrack){ return true; };

/**
 * Special method for AI track revisions.
 * @memberof ApiDocument
 * @param isTrack {boolean} - Specifies if the change tracking mode is set or not.
 * @param assistantName {string} - Specifies if the change tracking mode is set or not.
 * @returns {boolean}
 */
ApiDocument.prototype.SetAssistantTrackRevisions = function(isTrack, assistantName){ return true; };

/**
 * Checks if change tracking mode is enabled or not.
 * @memberof ApiDocument
 * @returns {boolean}
 */
ApiDocument.prototype.IsTrackRevisions = function(){ return true; };

/**
 * Returns a Range object that represents the part of the document contained in the specified document.
 * @memberof ApiDocument
 * @param {Number} Start - Start position index in the current element.
 * @param {Number} End - End position index in the current element.
 * @returns {ApiRange} 
 */
ApiDocument.prototype.GetRange = function(Start, End){ return new ApiRange(); };

/**
 * Returns a range object by the current selection.
 * @memberof ApiDocument
 * @returns {ApiRange | null} - returns null if selection doesn't exist.
 */
ApiDocument.prototype.GetRangeBySelect = function(){ return new ApiRange(); };

/**
 * Returns the last document element. 
 * @memberof ApiDocument
 * @returns {DocumentElement}
 */
ApiDocument.prototype.Last = function(){ return new DocumentElement(); };

/**
 * Removes a bookmark from the document, if one exists.
 * @memberof ApiDocument
 * @param {string} sName - The bookmark name.
 * @returns {boolean} - returns false if param is invalid.
 */
ApiDocument.prototype.DeleteBookmark = function(sName){ return true; };

/**
 * Returns a bookmark range.
 * @memberof ApiDocument
 * @param {string} sName - The bookmark name.
 * @returns {ApiRange | null} - returns null if sName is invalid.
 */
ApiDocument.prototype.GetBookmarkRange = function(sName){ return new ApiRange(); };

/**
 * Returns a collection of section objects in the document.
 * @memberof ApiDocument
 * @returns {ApiSection[]}  
 */
ApiDocument.prototype.GetSections = function(){ return [new ApiSection()]; };

/**
 * Returns a collection of tables on a given absolute page.
 * <note>This method can be a little bit slow, because it runs the document calculation
 * process to arrange tables on the specified page.</note>
 * @memberof ApiDocument
 * @param {number} nPage - The page index.
 * @returns {ApiTable[]}
 */
ApiDocument.prototype.GetAllTablesOnPage = function(nPage){ return [new ApiTable()]; };

/**
 * Adds a drawing to the specified page.
 * <note>This method can be a little bit slow, because it runs the document calculation
 * process to arrange tables on the specified page.</note>
 * @memberof ApiDocument
 * @param {ApiDrawing} oDrawing - A drawing to add to the page.
 * @param {number} nPage - The page index.
 * @param {EMU} x - The X coordinate in English measure units.
 * @param {EMU} y - The Y coordinate in English measure units.
 * @returns {boolean}
 */
ApiDocument.prototype.AddDrawingToPage = function(oDrawing, nPage, x, y){ return true; };

/**
 * Removes the current selection.
 * @memberof ApiDocument
 * @returns {boolean}
 */
ApiDocument.prototype.RemoveSelection = function(){ return true; };

/**
 * Searches for a scope of a document object. The search results are a collection of ApiRange objects.
 * @memberof ApiDocument
 * @param {string} sText - Search string.
 * @param {boolean} isMatchCase - Case sensitive or not.
 * @returns {ApiRange[]}  
 */
ApiDocument.prototype.Search = function(sText, isMatchCase){ return [new ApiRange()]; };

/**
 * Converts a document to Markdown.
 * @memberof ApiDocument
 * @param {boolean} [bHtmlHeadings=false] - Defines if the HTML headings and IDs will be generated when the Markdown renderer of your target platform does not handle Markdown-style IDs.
 * @param {boolean} [bBase64img=false] - Defines if the images will be created in the base64 format.
 * @param {boolean} [bDemoteHeadings=false] - Defines if all heading levels in your document will be demoted to conform with the following standard: single H1 as title, H2 as top-level heading in the text body.
 * @param {boolean} [bRenderHTMLTags=false] - Defines if HTML tags will be preserved in your Markdown. If you just want to use an occasional HTML tag, you can avoid using the opening angle bracket
 * in the following way: \<tag&gt;text\</tag&gt;. By default, the opening angle brackets will be replaced with the special characters.
 * @returns {string}
 */
ApiDocument.prototype.ToMarkdown = function(bHtmlHeadings, bBase64img, bDemoteHeadings, bRenderHTMLTags){ return ""; };

/**
 * Converts a document to HTML.
 * @memberof ApiDocument
 * @param {boolean} [bHtmlHeadings=false] - Defines if the HTML headings and IDs will be generated when the Markdown renderer of your target platform does not handle Markdown-style IDs.
 * @param {boolean} [bBase64img=false] - Defines if the images will be created in the base64 format.
 * @param {boolean} [bDemoteHeadings=false] - Defines if all heading levels in your document will be demoted to conform with the following standard: single H1 as title, H2 as top-level heading in the text body.
 * @param {boolean} [bRenderHTMLTags=false] - Defines if HTML tags will be preserved in your Markdown. If you just want to use an occasional HTML tag, you can avoid using the opening angle bracket
 * in the following way: \<tag&gt;text\</tag&gt;. By default, the opening angle brackets will be replaced with the special characters.
 * @returns {string}
 */
ApiDocument.prototype.ToHtml = function(bHtmlHeadings, bBase64img, bDemoteHeadings, bRenderHTMLTags){ return ""; };

/**
 * Inserts a watermark on each document page.
 * @memberof ApiDocument
 * @param {string} [sText="WATERMARK"] - Watermark text.
 * @param {boolean} [bIsDiagonal=false] - Specifies if the watermark is placed diagonally (true) or horizontally (false).
 * @returns {boolean}
 */
ApiDocument.prototype.InsertWatermark = function(sText, bIsDiagonal){ return true; };

/**
 * Returns the watermark settings in the current document.
 * @memberof ApiDocument
 * @returns {ApiWatermarkSettings} - The object which represents the watermark settings.
 */
ApiDocument.prototype.GetWatermarkSettings = function(){ return new ApiWatermarkSettings(); };

/**
 * Sets the watermark settings in the current document.
 * @memberof ApiDocument
 * @param {ApiWatermarkSettings} Settings - The object which represents the watermark settings.
 * @returns {ApiDrawing} - The object which represents the watermark drawing if the watermark type in Settings is not "none".
 */
ApiDocument.prototype.SetWatermarkSettings = function(Settings){ return new ApiDrawing(); };

/**
 * Removes a watermark from the current document.
 * @memberof ApiDocument
 * @returns {boolean}
 */
ApiDocument.prototype.RemoveWatermark = function(){ return true; };

/**
 * Updates all tables of contents in the current document.
 * @memberof ApiDocument
 * @param {boolean} [bOnlyPageNumbers=false] - Specifies that only page numbers will be updated.
 * @returns {boolean}
 */
ApiDocument.prototype.UpdateAllTOC = function(bOnlyPageNumbers){ return true; };

/**
 * Updates all tables of figures in the current document.
 * @memberof ApiDocument
 * @param {boolean} [bOnlyPageNumbers=false] - Specifies that only page numbers will be updated.
 * @returns {boolean}
 */
ApiDocument.prototype.UpdateAllTOF = function(bOnlyPageNumbers){ return true; };

/**
 * Updates all fields in the document.
 * @memberof ApiDocument
 * @param {boolean} [bBySelection=false] - Specifies whether all fields will be updated within the selection.
 * @returns {boolean}
 * @since 8.2.0
 */
ApiDocument.prototype.UpdateAllFields = function(bBySelection){ return true; };

/**
 * Converts the ApiDocument object into the JSON object.
 * @memberof ApiDocument
 * @param {boolean} bWriteDefaultTextPr - Specifies if the default text properties will be written to the JSON object or not.
 * @param {boolean} bWriteDefaultParaPr - Specifies if the default paragraph properties will be written to the JSON object or not.
 * @param {boolean} bWriteTheme - Specifies if the document theme will be written to the JSON object or not.
 * @param {boolean} bWriteSectionPr - Specifies if the document section properties will be written to the JSON object or not.
 * @param {boolean} bWriteNumberings - Specifies if the document numberings will be written to the JSON object or not.
 * @param {boolean} bWriteStyles - Specifies if the document styles will be written to the JSON object or not.
 * @returns {JSON}
 */
ApiDocument.prototype.ToJSON = function(bWriteDefaultTextPr, bWriteDefaultParaPr, bWriteTheme, bWriteSectionPr, bWriteNumberings, bWriteStyles){ return new JSON(); };

/**
 * Returns all existing forms in the document.
 * @memberof ApiDocument
 * @returns {ApiForm[]}
 */
ApiDocument.prototype.GetAllForms = function(){ return [new ApiForm()]; };

/**
 * Clears all forms in the document.
 * @memberof ApiDocument
 * @returns {boolean}
 */
ApiDocument.prototype.ClearAllFields = function(){ return true; };

/**
 * Sets the highlight to the forms in the document.
 * @memberof ApiDocument
 * @param {byte} r - Red color component value.
 * @param {byte} g - Green color component value.
 * @param {byte} b - Blue color component value.
 * @param {boolean} [bNone=false] - Defines that highlight will not be set.
 * @returns {boolean}
 */
ApiDocument.prototype.SetFormsHighlight = function(r, g, b, bNone){ return true; };

/**
 * Returns all comments from the current document.
 * @memberof ApiDocument
 * @returns {ApiComment[]}
 */
ApiDocument.prototype.GetAllComments = function(){ return [new ApiComment()]; };

/**
 * Returns a comment from the current document by its ID.
 * @memberof ApiDocument
 * @param {string} sId - The comment ID.
 * @returns {ApiComment}
 */
ApiDocument.prototype.GetCommentById = function(sId){ return new ApiComment(); };

/**
 * Show a comment by its ID.
 * @memberof ApiDocument
 * @param {string | Array.string} commentId - The comment ID.
 * @returns {boolean}
 * @since 9.0.4
 */
ApiDocument.prototype.ShowComment = function(commentId){ return true; };

/**
 * Returns all numbered paragraphs from the current document.
 * @memberof ApiDocument
 * @returns {ApiParagraph[]}
 */
ApiDocument.prototype.GetAllNumberedParagraphs = function(){ return [new ApiParagraph()]; };

/**
 * Returns all heading paragraphs from the current document.
 * @memberof ApiDocument
 * @returns {ApiParagraph[]}
 */
ApiDocument.prototype.GetAllHeadingParagraphs = function(){ return [new ApiParagraph()]; };

/**
 * Returns the first paragraphs from all footnotes in the current document.
 * @memberof ApiDocument
 * @returns {ApiParagraph[]}
 */
ApiDocument.prototype.GetFootnotesFirstParagraphs = function(){ return [new ApiParagraph()]; };

/**
 * Returns the first paragraphs from all endnotes in the current document.
 * @memberof ApiDocument
 * @returns {ApiParagraph[]}
 */
ApiDocument.prototype.GetEndNotesFirstParagraphs = function(){ return [new ApiParagraph()]; };

/**
 * Returns all caption paragraphs of the specified type from the current document.
 * @memberof ApiDocument
 * @param {CaptionLabel | string} sCaption - The caption label ("Equation", "Figure", "Table", or another caption label).
 * @returns {ApiParagraph[]}
 */
ApiDocument.prototype.GetAllCaptionParagraphs = function(sCaption){ return [new ApiParagraph()]; };

/**
 * Accepts all changes made in review mode.
 * @memberof ApiDocument
 * @returns {boolean}
 */
ApiDocument.prototype.AcceptAllRevisionChanges = function(){ return true; };

/**
 * Rejects all changes made in review mode.
 * @memberof ApiDocument
 * @returns {boolean}
 */
ApiDocument.prototype.RejectAllRevisionChanges = function(){ return true; };

/**
 * Returns an array with names of all bookmarks in the current document.
 * @memberof ApiDocument
 * @returns {string[]}
 */
ApiDocument.prototype.GetAllBookmarksNames = function(){ return [""]; };

/**
 * Returns a bookmark by its name from the current document.
 * @memberof ApiDocument
 * @param {string} sBookmarkName - The bookmark name.
 * @returns {ApiBookmark}
 * @since 8.3.0
 */
ApiDocument.prototype.GetBookmark = function(sBookmarkName){ return new ApiBookmark(); };

/**
 * Returns all the selected drawings in the current document.
 * @memberof ApiDocument
 * @returns {ApiShape[] | ApiImage[] | ApiChart[] | ApiDrawing[]}
 */
ApiDocument.prototype.GetSelectedDrawings = function(){ return [new ApiShape()]; };

/**
 * Replaces the current image with an image specified.
 * @memberof ApiDocument
 * @param {string} sImageUrl - The image source where the image to be inserted should be taken from (currently, only internet URL or Base64 encoded images are supported).
 * @param {EMU} Width - The image width in English measure units.
 * @param {EMU} Height - The image height in English measure units.
 * @returns {boolean}
 */
ApiDocument.prototype.ReplaceCurrentImage = function(sImageUrl, Width, Height){ return true; };

/**
 * Replaces a drawing with a new drawing.
 * @memberof ApiDocument
 * @param {ApiDrawing} oOldDrawing - A drawing which will be replaced.
 * @param {ApiDrawing} oNewDrawing - A drawing to replace the old drawing.
 * @param {boolean} [bSaveOldDrawingPr=false] - Specifies if the old drawing settings will be saved.
 * @returns {boolean}
 */
ApiDocument.prototype.ReplaceDrawing = function(oOldDrawing, oNewDrawing, bSaveOldDrawingPr){ return true; };

/**
 * Adds a footnote for the selected text (or the current position if the selection doesn't exist).
 * @memberof ApiDocument
 * @returns {ApiDocumentContent}
 */
ApiDocument.prototype.AddFootnote = function(){ return new ApiDocumentContent(); };

/**
 * Adds an endnote for the selected text (or the current position if the selection doesn't exist).
 * @memberof ApiDocument
 * @returns {ApiDocumentContent}
 */
ApiDocument.prototype.AddEndnote = function(){ return new ApiDocumentContent(); };

/**
 * Sets the highlight to the content controls from the current document.
 * @memberof ApiDocument
 * @param {byte} r - Red color component value.
 * @param {byte} g - Green color component value.
 * @param {byte} b - Blue color component value.
 * @param {boolean} [bNone=false] - Defines that highlight will not be set.
 * @returns {boolean}
 */
ApiDocument.prototype.SetControlsHighlight = function(r, g, b, bNone){ return true; };

/**
 * Adds a table of content to the current document.
 * <note>Please note that the new table of contents replaces the existing table of contents.</note>
 * @memberof ApiDocument
 * @param {TocPr} [oTocPr={}] - Table of contents properties.
 * @returns {boolean}
 */
ApiDocument.prototype.AddTableOfContents = function(oTocPr){ return true; };

/**
 * Adds a table of figures to the current document.
 * @memberof ApiDocument
 * @param {TofPr} [oTofPr={}] - Table of figures properties.
 * <note>Please note that the table of figures properties will be filled with the default properties if they are undefined.</note>
 * @param {boolean} [bReplace=true] - Specifies whether to replace the selected table of figures instead of adding a new one.
 * @returns {boolean}
 */
ApiDocument.prototype.AddTableOfFigures = function(oTofPr, bReplace){ return true; };

/**
 * Returns the document statistics represented as an object with the following parameters:
 * <b>PageCount</b> - number of pages;
 * <b>WordsCount</b> - number of words;
 * <b>ParagraphCount</b> - number of paragraphs;
 * <b>SymbolsCount</b> - number of symbols;
 * <b>SymbolsWSCount</b> - number of symbols with spaces.
 * @memberof ApiDocument
 * @returns {object}
 */
ApiDocument.prototype.GetStatistics = function(){ return new object(); };

/**
 * Returns a number of pages in the current document.
 * <note>This method can be slow for large documents because it runs the document calculation
 * process before the full recalculation.</note>
 * @memberof ApiDocument
 * @returns {number}
 */
ApiDocument.prototype.GetPageCount = function(){ return 0; };

/**
 * Returns the index of the current page.
 * @memberof ApiDocument
 * @returns {number}
 * @since 8.3.0
 */
ApiDocument.prototype.GetCurrentPage = function(){ return 0; };

/**
 * Returns the indexes of the currently visible pages.
 * @memberof ApiDocument
 * @returns {number[]}
 * @since 8.3.0
 */
ApiDocument.prototype.GetCurrentVisiblePages = function(){ return [0]; };

/**
 * Returns all styles of the current document.
 * @memberof ApiDocument
 * @returns {ApiStyle[]}
 */
ApiDocument.prototype.GetAllStyles = function(){ return [new ApiStyle()]; };

/**
 * Returns the document information:
 * <b>Application</b> - the application the document was created with.
 * <b>CreatedRaw</b> - the date and time when the file was created.
 * <b>Created</b> - the parsed date and time when the file was created.
 * <b>LastModifiedRaw</b> - the date and time when the file was last modified.
 * <b>LastModified</b> - the parsed date and time when the file was last modified.
 * <b>LastModifiedBy</b> - the name of the user who made the latest change to the document.
 * <b>Authors</b> - the persons who created the file.
 * <b>Title</b> - the document title (this property allows you to simplify your documents classification).
 * <b>Tags</b> - the document tags (this property allows you to simplify your documents classification).
 * <b>Subject</b> - the document subject (this property allows you to simplify your documents classification).
 * <b>Comment</b> - the comment to the document (this property allows you to simplify your documents classification).
 * @memberof ApiDocument
 * @returns {object}
 * @since 8.1.0
 */
ApiDocument.prototype.GetDocumentInfo = function(){ return new object(); };

/**
 * Returns the current word or part of the current word.
 * @param {undefined | "before" | "after"} sWordPart - The desired part of the current word to be returned.
 * @memberof ApiDocument
 * @returns {string}
 * @since 8.2.0
 */
ApiDocument.prototype.GetCurrentWord = function(sWordPart){ return ""; };

/**
 * Replaces the current word or part of the current word with the specified text.
 * @param sReplace {string} - The string to replace the current word with.
 * @param {undefined | "before" | "after"} sPart - The desired part of the current word to be replaced.
 * @memberof ApiDocument
 * @returns {boolean}
 * @since 8.2.0
 */
ApiDocument.prototype.ReplaceCurrentWord = function(sReplace, sPart){ return true; };

/**
 * Selects the current word if it is possible.
 * @memberof ApiDocument
 * @returns {object}
 * @since 8.2.0
 */
ApiDocument.prototype.SelectCurrentWord = function(){ return new object(); };

/**
 * Adds a comment to the current document selection, or to the current word if no text is selected.
 * @memberof ApiDocument
 * @param {string} sText - The comment text.
 * @param {string} [sAuthor] - The author's name.
 * @param {string} [sUserId] - The user ID of the comment author.
 * @returns {ApiComment} - Returns null if the comment was not added.
 */
ApiDocument.prototype.AddComment = function(sText, sAuthor, sUserId){ return new ApiComment(); };

/**
 * Returns the current sentence or part of the current sentence.
 * @param {undefined | "before" | "after"} sPart - The desired part of the current sentence to be returned.
 * @memberof ApiDocument
 * @returns {string}
 * @since 8.2.0
 */
ApiDocument.prototype.GetCurrentSentence = function(sPart){ return ""; };

/**
 * Replaces the current sentence or part of the current sentence with the specified text.
 * @param sReplace {string} - The string to replace the current sentence with.
 * @param {undefined | "before" | "after"} sPart - The desired part of the current sentence to be replaced.
 * @memberof ApiDocument
 * @returns {boolean}
 * @since 8.2.0
 */
ApiDocument.prototype.ReplaceCurrentSentence = function(sReplace, sPart){ return true; };

/**
 * Adds a math equation to the current document.
 * @param sText {string} - An equation written as a linear text string.
 * @param {"unicode" | "latex" | "mathml"} [sFormat="unicode"] - The format of the specified linear representation.
 * @memberof ApiDocument
 * @returns {boolean}
 * @since 8.2.0
 */
ApiDocument.prototype.AddMathEquation = function(sText, sFormat){ return true; };

/**
 * Groups an array of drawings in the current document.
 * @memberof ApiDocument
 * @param {DrawingForGroup[]} aDrawings - An array of drawings to group.
 * @returns {ApiGroup}
 * @since 8.3.0
 */
ApiDocument.prototype.GroupDrawings = function(aDrawings){ return new ApiGroup(); };

/**
 * Moves a cursor to a specified position of the current document.
 * If there is any selection in the document, it will be removed.
 * @memberof ApiDocument
 * @param {number} [nPos=0] - The desired cursor position.
 * @returns {boolean}
 * @since 9.0.0
 */
ApiDocument.prototype.MoveCursorToPos = function(nPos){ return true; };

/**
 * Adds a new checkbox content control to the document.
 * @memberof ApiDocument
 * @since 9.0.0
 * @param {ContentControlCheckBoxPr} checkBoxPr The configuration object for the checkbox.
 * @returns {ApiInlineLvlSdt} An instance of the ApiInlineLvlSdt object representing the checkbox content control.
 */
ApiDocument.prototype.AddCheckBoxContentControl = function(checkBoxPr){ return new ApiInlineLvlSdt(); };

/**
 * Adds a new picture content control to the document.
 * @memberof ApiDocument
 * @since 9.0.0
 * @param {EMU} [width] - The optional width of the image.
 * @param {EMU} [height] - The optional height of the image.
 * @returns {ApiInlineLvlSdt} An instance of the ApiInlineLvlSdt object representing the picture content control.
 */
ApiDocument.prototype.AddPictureContentControl = function(width, height){ return new ApiInlineLvlSdt(); };

/**
 * Adds a new combo box content control to the document.
 * @memberof ApiDocument
 * @since 9.0.0
 * @param {ContentControlListItem[]} [list] - An array of objects representing the items in the combo box.
 * @param {string} [selected] - The optional value of the item that should be selected by default (must match one of the ListItem.Value).
 * @returns {ApiInlineLvlSdt}
 */
ApiDocument.prototype.AddComboBoxContentControl = function(list, selected){ return new ApiInlineLvlSdt(); };

/**
 * Adds a new drop-down list content control to the document.
 * @memberof ApiDocument
 * @since 9.0.0
 * @param {ContentControlListItem[]} [list] - An array of objects representing the items in the drop-down list.
 * @param {string} [selected] - The optional value of the item that should be selected by default (must match one of the ListItem.Value).
 * @returns {ApiInlineLvlSdt}
 */
ApiDocument.prototype.AddDropDownListContentControl = function(list, selected){ return new ApiInlineLvlSdt(); };

/**
 * Adds a new date picker content control to the document.
 * @memberof ApiDocument
 * @since 9.0.0
 * @param {ContentControlDatePr} [datePickerPr] - The optional date picker properties.
 * @returns {ApiInlineLvlSdt}
 */
ApiDocument.prototype.AddDatePickerContentControl = function(datePickerPr){ return new ApiInlineLvlSdt(); };

/**
 * Retrieves the custom XML manager associated with the document.
 * This manager allows manipulation and access to custom XML parts within the document.
 * @memberof ApiDocument
 * @since 9.0.0
 * @returns {ApiCustomXmlParts|null} Returns an instance of ApiCustomXmlParts if the custom XML manager exists, otherwise returns null.
 */
ApiDocument.prototype.GetCustomXmlParts = function(){ return new ApiCustomXmlParts(); };

/**
 * Retrieves the core properties interface for the current document.
 * This method is used to view or modify standard metadata such as title, author, and keywords.
 * @memberof ApiDocument
 * @returns {ApiCore} - The core document properties object.
 * @since 9.0.0
 */
ApiDocument.prototype.GetCore = function () { return new ApiCore(); };

/**
 * Retrieves the custom properties from the document.
 * @memberof ApiDocument
 * @returns {ApiCustomProperties}
 * @since 9.0.0
 */
ApiDocument.prototype.GetCustomProperties = function () { return new ApiCustomProperties(); };

/**
 * Insert blank page to the current location.
 * @memberof ApiDocument
 * @returns {boolean}
 * @since 9.0.4
 */
ApiDocument.prototype.InsertBlankPage = function(){ return true; };

/**
 * Moves cursor to the start of the document.
 * @memberof ApiDocument
 * @returns {boolean}
 * @since 9.0.4
 */
ApiDocument.prototype.MoveCursorToStart = function(){ return true; };

/**
 * Moves cursor to the end of the document.
 * @memberof ApiDocument
 * @returns {boolean}
 * @since 9.0.4
 */
ApiDocument.prototype.MoveCursorToEnd = function(){ return true; };

/**
 * Moves cursor to the start of the specified page in document.
 * @memberof ApiDocument
 * @param {number} index - index of page to go
 * @returns {boolean}
 * @since 9.1
 */
ApiDocument.prototype.GoToPage = function(index){ return true; };

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
 * Adds a page break and starts the next element from the next page.
 * @memberof ApiParagraph
 * @returns {ApiRun}
 */
ApiParagraph.prototype.AddPageBreak = function(){ return new ApiRun(); };

/**
 * Adds a line break to the current position and starts the next element from a new line.
 * @memberof ApiParagraph
 * @returns {ApiRun}
 */
ApiParagraph.prototype.AddLineBreak = function(){ return new ApiRun(); };

/**
 * Adds a column break to the current position and starts the next element from a new column.
 * @memberof ApiParagraph
 * @returns {ApiRun}
 */
ApiParagraph.prototype.AddColumnBreak = function(){ return new ApiRun(); };

/**
 * Inserts a number of the current document page into the paragraph.
 * @memberof ApiParagraph
 * @returns {ApiRun}
 */
ApiParagraph.prototype.AddPageNumber = function(){ return new ApiRun(); };

/**
 * Inserts a number of pages in the current document into the paragraph.
 * @memberof ApiParagraph
 * @returns {ApiRun}
 */
ApiParagraph.prototype.AddPagesCount = function(){ return new ApiRun(); };

/**
 * Returns the text properties of the paragraph mark which is used to mark the paragraph end. The mark can also acquire
 * common text properties like bold, italic, underline, etc.
 * @memberof ApiParagraph
 * @returns {ApiTextPr}
 */
ApiParagraph.prototype.GetParagraphMarkTextPr = function(){ return new ApiTextPr(); };

/**
 * Returns the paragraph properties.
 * @memberof ApiParagraph
 * @returns {ApiParaPr}
 */
ApiParagraph.prototype.GetParaPr = function(){ return new ApiParaPr(); };

/**
 * Returns the numbering definition and numbering level for the numbered list.
 * @memberof ApiParagraph
 * @returns {ApiNumberingLevel}
 */
ApiParagraph.prototype.GetNumbering = function(){ return new ApiNumberingLevel(); };

/**
 * Specifies that the current paragraph references the numbering definition instance in the current document.
 * @memberof ApiParagraph
 * @param {ApiNumberingLevel} oNumberingLevel - The numbering level which will be used for assigning the numbers to the paragraph.
 * @returns {boolean}
 */
ApiParagraph.prototype.SetNumbering = function(oNumberingLevel){ return true; };

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
 * Adds a drawing object (image, shape or chart) to the current paragraph.
 * @memberof ApiParagraph
 * @param {ApiDrawing} oDrawing - The object which will be added to the current paragraph.
 * @returns {ApiRun}
 */
ApiParagraph.prototype.AddDrawing = function(oDrawing){ return new ApiRun(); };

/**
 * Adds an inline container.
 * @memberof ApiParagraph
 * @param {ApiInlineLvlSdt} oSdt - An inline container. If undefined or null, then new class ApiInlineLvlSdt will be created and added to the paragraph.
 * @returns {ApiInlineLvlSdt}
 */
ApiParagraph.prototype.AddInlineLvlSdt = function(oSdt){ return new ApiInlineLvlSdt(); };

/**
 * Adds a comment to the current paragraph.
 * <note>Please note that this paragraph must be in the document.</note>
 * @memberof ApiParagraph
 * @param {string} sText - The comment text.
 * @param {string} [sAuthor] - The author's name.
 * @param {string} [sUserId] - The user ID of the comment author.
 * @returns {ApiComment} - Returns null if the comment was not added.
 */
ApiParagraph.prototype.AddComment = function(sText, sAuthor, sUserId){ return new ApiComment(); };

/**
 * Adds a hyperlink to a paragraph. 
 * @memberof ApiParagraph
 * @param {string} sLink - The link address.
 * @param {string} sScreenTipText - The screen tip text.
 * @returns {ApiHyperlink | null} - returns null if params are invalid.
 */
ApiParagraph.prototype.AddHyperlink = function(sLink, sScreenTipText){ return new ApiHyperlink(); };

/**
 * Returns a Range object that represents the part of the document contained in the specified paragraph.
 * @memberof ApiParagraph
 * @param {Number} Start - Start position index in the current element.
 * @param {Number} End - End position index in the current element.
 * @returns {ApiRange} 
 */
ApiParagraph.prototype.GetRange = function(Start, End){ return new ApiRange(); };

/**
 * Adds an element to the current paragraph.
 * @memberof ApiParagraph
 * @param {ParagraphContent} oElement - The document element which will be added at the current position. Returns false if the
 * oElement type is not supported by a paragraph.
 * @returns {boolean} Returns <code>false</code> if the type of <code>oElement</code> is not supported by paragraph
 * content.
 */
ApiParagraph.prototype.Push = function(oElement){ return true; };

/**
 * Returns the last Run with text in the current paragraph.
 * @memberof ApiParagraph
 * @returns {ApiRun} Returns <code>false</code> if the paragraph doesn't containt the required run.
 */
ApiParagraph.prototype.GetLastRunWithText = function(){ return new ApiRun(); };

/**
 * Sets the bold property to the text character.
 * @memberof ApiParagraph
 * @param {boolean} isBold - Specifies that the contents of this paragraph are displayed bold.
 * @returns {ApiParagraph} this
 */
ApiParagraph.prototype.SetBold = function(isBold){ return new ApiParagraph(); };

/**
 * Specifies that any lowercase characters in this paragraph are formatted for display only as their capital letter character equivalents.
 * @memberof ApiParagraph
 * @param {boolean} isCaps - Specifies that the contents of the current paragraph are displayed capitalized.
 * @returns {ApiParagraph} this
 */
ApiParagraph.prototype.SetCaps = function(isCaps){ return new ApiParagraph(); };

/**
 * Sets the text color to the current paragraph in the RGB format.
 * @memberof ApiParagraph
 * @param {byte} r - Red color component value.
 * @param {byte} g - Green color component value.
 * @param {byte} b - Blue color component value.
 * @param {boolean} [isAuto=false] - If this parameter is set to "true", then r,g,b parameters will be ignored.
 * @returns {ApiParagraph} this
 */
ApiParagraph.prototype.SetColor = function(r, g, b, isAuto){ return new ApiParagraph(); };

/**
 * Specifies that the contents of this paragraph are displayed with two horizontal lines through each character displayed on the line.
 * @memberof ApiParagraph
 * @param {boolean} isDoubleStrikeout - Specifies that the contents of the current paragraph are displayed double struck through.
 * @returns {ApiParagraph} this
 */
ApiParagraph.prototype.SetDoubleStrikeout = function(isDoubleStrikeout){ return new ApiParagraph(); };

/**
 * Sets all 4 font slots with the specified font family.
 * @memberof ApiParagraph
 * @param {string} sFontFamily - The font family or families used for the current paragraph.
 * @returns {ApiParagraph} this
 */
ApiParagraph.prototype.SetFontFamily = function(sFontFamily){ return new ApiParagraph(); };

/**
 * Returns all font names from all elements inside the current paragraph.
 * @memberof ApiParagraph
 * @returns {string[]} - The font names used for the current paragraph.
 */
ApiParagraph.prototype.GetFontNames = function(){ return [""]; };

/**
 * Sets the font size to the characters of the current paragraph.
 * @memberof ApiParagraph
 * @param {hps} nSize - The text size value measured in half-points (1/144 of an inch).
 * @returns {ApiParagraph} this
 */
ApiParagraph.prototype.SetFontSize = function(nSize){ return new ApiParagraph(); };

/**
 * Specifies a highlighting color which is applied as a background to the contents of the current paragraph.
 * @memberof ApiParagraph
 * @param {highlightColor} sColor - Available highlight color.
 * @returns {ApiParagraph} this
 */
ApiParagraph.prototype.SetHighlight = function(sColor){ return new ApiParagraph(); };

/**
 * Sets the italic property to the text character.
 * @memberof ApiParagraph
 * @param {boolean} isItalic - Specifies that the contents of the current paragraph are displayed italicized.
 * @returns {ApiParagraph} this
 */
ApiParagraph.prototype.SetItalic = function(isItalic){ return new ApiParagraph(); };

/**
 * Specifies an amount by which text is raised or lowered for this paragraph in relation to the default
 * baseline of the surrounding non-positioned text.
 * @memberof ApiParagraph
 * @param {hps} nPosition - Specifies a positive (raised text) or negative (lowered text)
 * measurement in half-points (1/144 of an inch).
 * @returns {ApiParagraph} this
 */
ApiParagraph.prototype.SetPosition = function(nPosition){ return new ApiParagraph(); };

/**
 * Specifies that all the small letter characters in this paragraph are formatted for display only as their capital
 * letter character equivalents which are two points smaller than the actual font size specified for this text.
 * @memberof ApiParagraph
 * @param {boolean} isSmallCaps - Specifies if the contents of the current paragraph are displayed capitalized two points smaller or not.
 * @returns {ApiParagraph} this
 */
ApiParagraph.prototype.SetSmallCaps = function(isSmallCaps){ return new ApiParagraph(); };

/**
 * Sets the text spacing measured in twentieths of a point.
 * @memberof ApiParagraph
 * @param {twips} nSpacing - The value of the text spacing measured in twentieths of a point (1/1440 of an inch).
 * @returns {ApiParagraph} this
 */
ApiParagraph.prototype.SetSpacing = function(nSpacing){ return new ApiParagraph(); };

/**
 * Specifies that the contents of this paragraph are displayed with a single horizontal line through the center of the line.
 * @memberof ApiParagraph
 * @param {boolean} isStrikeout - Specifies that the contents of the current paragraph are displayed struck through.
 * @returns {ApiParagraph} this
 */
ApiParagraph.prototype.SetStrikeout = function(isStrikeout){ return new ApiParagraph(); };

/**
 * Specifies that the contents of this paragraph are displayed along with a line appearing directly below the character
 * (less than all the spacing above and below the characters on the line).
 * @memberof ApiParagraph
 * @param {boolean} isUnderline - Specifies that the contents of the current paragraph are displayed underlined.
 * @returns {ApiParagraph} this
 */
ApiParagraph.prototype.SetUnderline = function(isUnderline){ return new ApiParagraph(); };

/**
 * Specifies the alignment which will be applied to the contents of this paragraph in relation to the default appearance of the paragraph text:
 * <b>"baseline"</b> - the characters in the current paragraph will be aligned by the default text baseline.
 * <b>"subscript"</b> - the characters in the current paragraph will be aligned below the default text baseline.
 * <b>"superscript"</b> - the characters in the current paragraph will be aligned above the default text baseline.
 * @memberof ApiParagraph
 * @param {("baseline" | "subscript" | "superscript")} sType - The vertical alignment type applied to the text contents.
 * @returns {ApiParagraph | null} - returns null is sType is invalid.
 */
ApiParagraph.prototype.SetVertAlign = function(sType){ return new ApiParagraph(); };

/**
 * Specifies the reading order for the paragraph. Possible values are:
 * <b>null</b> - Use standart direction parameter.
 * <b>"ltr"</b> - Left-to-Right text direction.
 * <b>"rtl"</b> - Right-to-Left text direction.
 * @memberof ApiParagraph
 * @param {?ReadingOrder} [readingOrder = undefined]
 * @returns {ApiParagraph} - Returns paragraph itself (ApiParagraph)
 */
ApiParagraph.prototype.SetReadingOrder = function (readingOrder) { return new ApiParagraph(); };

/**
 * Returns the last element of the paragraph which is not empty.
 * @memberof ApiParagraph
 * @returns {ParagraphContent}
 */
ApiParagraph.prototype.Last = function(){ return new ParagraphContent(); };

/**
 * Returns a collection of content control objects in the paragraph.
 * @memberof ApiParagraph
 * @returns {ApiInlineLvlSdt[]}   
 */
ApiParagraph.prototype.GetAllContentControls = function(){ return [new ApiInlineLvlSdt()]; };

/**
 * Returns a collection of drawing objects in the paragraph.
 * @memberof ApiParagraph
 * @returns {Drawing[]}  
 */
ApiParagraph.prototype.GetAllDrawingObjects = function(){ return [new Drawing()]; };

/**
 * Returns a collection of shape objects in the paragraph.
 * @memberof ApiParagraph
 * @returns {ApiShape[]}  
 */
ApiParagraph.prototype.GetAllShapes = function(){ return [new ApiShape()]; };

/**
 * Returns a collection of image objects in the paragraph.
 * @memberof ApiParagraph
 * @returns {ApiImage[]}  
 */
ApiParagraph.prototype.GetAllImages = function(){ return [new ApiImage()]; };

/**
 * Returns a collection of chart objects in the paragraph.
 * @memberof ApiParagraph
 * @returns {ApiChart[]}  
 */
ApiParagraph.prototype.GetAllCharts = function(){ return [new ApiChart()]; };

/**
 * Returns a collection of OLE objects in the paragraph.
 * @memberof ApiParagraph
 * @returns {ApiOleObject[]}  
 */
ApiParagraph.prototype.GetAllOleObjects = function(){ return [new ApiOleObject()]; };

/**
 * Returns a content control that contains the current paragraph.
 * @memberof ApiParagraph
 * @returns {ApiBlockLvlSdt | null} - returns null is parent content control doesn't exist.  
 */
ApiParagraph.prototype.GetParentContentControl = function(){ return new ApiBlockLvlSdt(); };

/**
 * Returns a table that contains the current paragraph.
 * @memberof ApiParagraph
 * @returns {ApiTable | null} - returns null if parent table doesn't exist.  
 */
ApiParagraph.prototype.GetParentTable = function(){ return new ApiTable(); };

/**
 * Returns a table cell that contains the current paragraph.
 * @memberof ApiParagraph
 * @returns {ApiTableCell | null} - returns null if parent cell doesn't exist.  
 */
ApiParagraph.prototype.GetParentTableCell = function(){ return new ApiTableCell(); };

/**
 * Returns the paragraph text.
 * @memberof ApiParagraph
 * @param {object} oPr - The resulting string display properties.
 * @param {boolean} [oPr.Numbering=false] - Defines if the resulting string will include numbering or not.
 * @param {boolean} [oPr.Math=false] - Defines if the resulting string will include mathematical expressions or not.
 * @param {string} [oPr.NewLineSeparator='\r'] - Defines how the line separator will be specified in the resulting string. Any symbol can be used. The default separator is "\r".
 * @param {string} [oPr.TabSymbol='\t'] - Defines how the tab will be specified in the resulting string (does not apply to numbering). Any symbol can be used. The default symbol is "\t".
 * @returns {string}
 */
ApiParagraph.prototype.GetText = function(oPr){ return ""; };

/**
 * Returns the text properties for a paragraph end mark.
 * @memberof ApiParagraph
 * @returns {ApiTextPr}  
 */
ApiParagraph.prototype.GetTextPr = function(){ return new ApiTextPr(); };

/**
 * Sets the paragraph text properties.
 * @memberof ApiParagraph
 * @param {ApiTextPr} oTextPr - The paragraph text properties.
 * @returns {boolean} - returns false if param is invalid.
 */
ApiParagraph.prototype.SetTextPr = function(oTextPr){ return true; };

/**
 * Wraps the paragraph object with a rich text content control.
 * @memberof ApiParagraph
 * @param {number} nType - Defines if this method returns the ApiBlockLvlSdt (nType === 1) or ApiParagraph (any value except 1) object.
 * @returns {ApiParagraph | ApiBlockLvlSdt}  
 */
ApiParagraph.prototype.InsertInContentControl = function(nType){ return new ApiParagraph(); };

/**
 * Inserts a paragraph at the specified position.
 * @memberof ApiParagraph
 * @param {string | ApiParagraph} paragraph - Text or paragraph.
 * @param {string} sPosition - The position where the text or paragraph will be inserted ("before" or "after" the paragraph specified).
 * @param {boolean} beRNewPara - Defines if this method returns a new paragraph (true) or the current paragraph (false).
 * @returns {ApiParagraph | null} - returns null if param paragraph is invalid. 
 */
ApiParagraph.prototype.InsertParagraph = function(paragraph, sPosition, beRNewPara){ return new ApiParagraph(); };

/**
 * Selects the current paragraph.
 * @memberof ApiParagraph
 * @returns {boolean}
 */
ApiParagraph.prototype.Select = function(){ return true; };

/**
 * Searches for a scope of a paragraph object. The search results are a collection of ApiRange objects.
 * @memberof ApiParagraph
 * @param {string} sText - Search string.
 * @param {boolean} isMatchCase - Case sensitive or not.
 * @returns {ApiRange[]}  
 */
ApiParagraph.prototype.Search = function(sText, isMatchCase){ return [new ApiRange()]; };

/**
 * Wraps the paragraph content in a mail merge field.
 * @memberof ApiParagraph
 * @returns {boolean}
 */
ApiParagraph.prototype.WrapInMailMergeField = function(){ return true; };

/**
 * Adds a numbered cross-reference to the current paragraph.
 * <note>Please note that this paragraph must be in the document.</note>
 * @memberof ApiParagraph
 * @param {numberedRefTo} sRefType - The text or numeric value of a numbered reference you want to insert.
 * @param {ApiParagraph} oParaTo - The numbered paragraph to be referred to (must be in the document).
 * @param {boolean} [bLink=true] - Specifies if the reference will be inserted as a hyperlink.
 * @param {boolean} [bAboveBelow=false] - Specifies if the above/below words indicating the position of the reference should be included (don't used with the "text" and "aboveBelow" sRefType).
 * @param {string} [sSepWith=""] - A number separator (used only with the "fullCtxParaNum" sRefType).
 * @returns {boolean}
 */
ApiParagraph.prototype.AddNumberedCrossRef = function(sRefTo, oParaTo, bLink, bAboveBelow, sSepWith){ return true; };

/**
 * Adds a heading cross-reference to the current paragraph.
 * <note>Please note that this paragraph must be in the document.</note>
 * @memberof ApiParagraph
 * @param {headingRefTo} sRefType - The text or numeric value of a heading reference you want to insert.
 * @param {ApiParagraph} oParaTo - The heading paragraph to be referred to (must be in the document).
 * @param {boolean} [bLink=true] - Specifies if the reference will be inserted as a hyperlink.
 * @param {boolean} [bAboveBelow=false] - Specifies if the above/below words indicating the position of the reference should be included (don't used with the "text" and "aboveBelow" sRefType).
 * @returns {boolean}
 */
ApiParagraph.prototype.AddHeadingCrossRef = function(sRefTo, oParaTo, bLink, bAboveBelow){ return true; };

/**
 * Adds a bookmark cross-reference to the current paragraph.
 * <note>Please note that this paragraph must be in the document.</note>
 * @memberof ApiParagraph
 * @param {bookmarkRefTo} sRefTo - The text or numeric value of a bookmark reference you want to insert.
 * @param {string} sBookmarkName - The name of the bookmark to be referred to (must be in the document).
 * @param {boolean} [bLink=true] - Specifies if the reference will be inserted as a hyperlink.
 * @param {boolean} [bAboveBelow=false] - Specifies if the above/below words indicating the position of the reference should be included (don't used with the "text" and "aboveBelow" sRefType).
 * @param {string} [sSepWith=""] - A number separator (used only with the "fullCtxParaNum" sRefType).
 * @returns {boolean}
 */
ApiParagraph.prototype.AddBookmarkCrossRef = function(sRefTo, sBookmarkName, bLink, bAboveBelow, sSepWith){ return true; };

/**
 * Adds a footnote cross-reference to the current paragraph.
 * <note>Please note that this paragraph must be in the document.</note>
 * @memberof ApiParagraph
 * @param {footnoteRefTo} sRefType - The text or numeric value of a footnote reference you want to insert.
 * @param {ApiParagraph} oParaTo - The first paragraph from a footnote to be referred to (must be in the document).
 * @param {boolean} [bLink=true] - Specifies if the reference will be inserted as a hyperlink.
 * @param {boolean} [bAboveBelow=false] - Specifies if the above/below words indicating the position of the reference should be included (don't used with the "aboveBelow" sRefType).
 * @returns {boolean}
 */
ApiParagraph.prototype.AddFootnoteCrossRef = function(sRefTo, oParaTo, bLink, bAboveBelow){ return true; };

/**
 * Adds an endnote cross-reference to the current paragraph.
 * <note>Please note that this paragraph must be in the document.</note>
 * @memberof ApiParagraph
 * @param {endnoteRefTo} sRefType - The text or numeric value of an endnote reference you want to insert.
 * @param {ApiParagraph} oParaTo - The first paragraph from an endnote to be referred to (must be in the document).
 * @param {boolean} [bLink=true] - Specifies if the reference will be inserted as a hyperlink.
 * @param {boolean} [bAboveBelow=false] - Specifies if the above/below words indicating the position of the reference should be included (don't used with the "aboveBelow" sRefType).
 * @returns {boolean}
 */
ApiParagraph.prototype.AddEndnoteCrossRef = function(sRefTo, oParaTo, bLink, bAboveBelow){ return true; };

/**
 * Adds a caption cross-reference to the current paragraph.
 * <note>Please note that this paragraph must be in the document.</note>
 * @memberof ApiParagraph
 * @param {CaptionLabel | string} sCaption - The caption label ("Equation", "Figure", "Table", or another caption label).
 * @param {captionRefTo} sRefType - The text or numeric value of a caption reference you want to insert.
 * @param {ApiParagraph} oParaTo - The caption paragraph to be referred to (must be in the document).
 * @param {boolean} [bLink=true] - Specifies if the reference will be inserted as a hyperlink.
 * @param {boolean} [bAboveBelow=false] - Specifies if the above/below words indicating the position of the reference should be included (used only with the "pageNum" sRefType).
 * @returns {boolean}
 */
ApiParagraph.prototype.AddCaptionCrossRef = function(sCaption, sRefTo, oParaTo, bLink, bAboveBelow){ return true; };

/**
 * Converts the ApiParagraph object into the JSON object.
 * @memberof ApiParagraph
 * @param {boolean} bWriteNumberings - Specifies if the used numberings will be written to the JSON object or not.
 * @param {boolean} bWriteStyles - Specifies if the used styles will be written to the JSON object or not.
 * @returns {JSON}
 */
ApiParagraph.prototype.ToJSON = function(bWriteNumberings, bWriteStyles){ return new JSON(); };

/**
 * Returns the paragraph position within its parent element.
 * @memberof ApiParagraph
 * @returns {Number} - returns -1 if the paragraph parent doesn't exist. 
 */
ApiParagraph.prototype.GetPosInParent = function(){ return 0; };

/**
 * Replaces the current paragraph with a new element.
 * @memberof ApiParagraph
 * @param {DocumentElement} oElement - The element to replace the current paragraph with.
 * @returns {boolean}
 */
ApiParagraph.prototype.ReplaceByElement = function(oElement){ return true; };

/**
 * Adds a caption paragraph after (or before) the current paragraph.
 * <note>Please note that the current paragraph must be in the document (not in the footer/header).
 * And if the current paragraph is placed in a shape, then a caption is added after (or before) the parent shape.</note>
 * @memberof ApiParagraph
 * @param {string} sAdditional - The additional text.
 * @param {CaptionLabel | String} [sLabel="Table"] - The caption label.
 * @param {boolean} [bExludeLabel=false] - Specifies whether to exclude the label from the caption.
 * @param {CaptionNumberingFormat} [sNumberingFormat="Arabic"] - The possible caption numbering format.
 * @param {boolean} [bBefore=false] - Specifies whether to insert the caption before the current paragraph (true) or after (false) (after/before the shape if it is placed in the shape).
 * @param {Number} [nHeadingLvl=undefined] - The heading level (used if you want to specify the chapter number).
 * <note>If you want to specify "Heading 1", then nHeadingLvl === 0 and etc.</note>
 * @param {CaptionSep} [sCaptionSep="hyphen"] - The caption separator (used if you want to specify the chapter number).
 * @returns {boolean}
 */
ApiParagraph.prototype.AddCaption = function(sAdditional, sLabel, bExludeLabel, sNumberingFormat, bBefore, nHeadingLvl, sCaptionSep){ return true; };

/**
 * Returns the paragraph section.
 * @memberof ApiParagraph
 * @returns {ApiSection}
 */
ApiParagraph.prototype.GetSection = function(){ return new ApiSection(); };

/**
 * Sets the specified section to the current paragraph.
 * @memberof ApiParagraph
 * @param {ApiSection} oSection - The section which will be set to the paragraph.
 * @returns {boolean}
 */
ApiParagraph.prototype.SetSection = function(oSection){ return true; };

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
 * Adds a page break and starts the next element from a new page.
 * @memberof ApiRun
 * @returns {boolean}
 */
ApiRun.prototype.AddPageBreak = function(){ return true; };

/**
 * Adds a line break to the current run position and starts the next element from a new line.
 * @memberof ApiRun
 * @returns {boolean}
 */
ApiRun.prototype.AddLineBreak = function(){ return true; };

/**
 * Adds a column break to the current run position and starts the next element from a new column.
 * @memberof ApiRun
 * @returns {boolean}
 */
ApiRun.prototype.AddColumnBreak = function(){ return true; };

/**
 * Adds a tab stop to the current run.
 * @memberof ApiRun
 * @returns {boolean}
 */
ApiRun.prototype.AddTabStop = function(){ return true; };

/**
 * Adds a drawing object (image, shape or chart) to the current text run.
 * @memberof ApiRun
 * @param {ApiDrawing} oDrawing - The object which will be added to the current run.
 * @returns {boolean} - returns false if param is invalid.
 */
ApiRun.prototype.AddDrawing = function(oDrawing){ return true; };

/**
 * Selects the current run.
 * @memberof ApiRun
 * @returns {boolean}
 */
ApiRun.prototype.Select = function(){ return true; };

/**
 * Adds a hyperlink to the current run. 
 * @memberof ApiRun
 * @param {string} sLink - The link address.
 * @param {string} sScreenTipText - The screen tip text.
 * @returns {ApiHyperlink | null} - returns false if params are invalid.
 */
ApiRun.prototype.AddHyperlink = function(sLink, sScreenTipText){ return new ApiHyperlink(); };

/**
 * Creates a copy of the current run.
 * @memberof ApiRun
 * @returns {ApiRun}
 */
ApiRun.prototype.Copy = function(){ return new ApiRun(); };

/**
 * Returns a Range object that represents the part of the document contained in the specified run.
 * @memberof ApiRun
 * @param {Number} Start - Start position index in the current element.
 * @param {Number} End - End position index in the current element.
 * @returns {ApiRange} 
 */
ApiRun.prototype.GetRange = function(Start, End){ return new ApiRange(); };

/**
 * Returns a content control that contains the current run.
 * @memberof ApiRun
 * @returns {ApiBlockLvlSdt | ApiInlineLvlSdt | null} - returns null if parent content control doesn't exist.  
 */
ApiRun.prototype.GetParentContentControl = function(){ return new ApiBlockLvlSdt(); };

/**
 * Returns a table that contains the current run.
 * @memberof ApiRun
 * @returns {ApiTable | null} - returns null if parent table doesn't exist.
 */
ApiRun.prototype.GetParentTable = function(){ return new ApiTable(); };

/**
 * Returns a table cell that contains the current run.
 * @memberof ApiRun
 * @returns {ApiTableCell | null} - returns null is parent cell doesn't exist.  
 */
ApiRun.prototype.GetParentTableCell = function(){ return new ApiTableCell(); };

/**
 * Returns a parent paragraph of the current run.
 * @memberof ApiRun
 * @returns {ApiParagraph}
 */
ApiRun.prototype.GetParentParagraph = function(){ return new ApiParagraph(); };

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
 * Sets a style to the current run.
 * @memberof ApiRun
 * @param {ApiStyle} oStyle - The style which must be applied to the text run.
 * @returns {ApiTextPr}
 */
ApiRun.prototype.SetStyle = function(oStyle){ return new ApiTextPr(); };

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
 * Wraps a run in a mail merge field.
 * @memberof ApiRun
 * @returns {boolean}
 */
ApiRun.prototype.WrapInMailMergeField = function(){ return true; };

/**
 * Converts the ApiRun object into the JSON object.
 * @memberof ApiRun
 * @param {boolean} bWriteStyles - Specifies if the used styles will be written to the JSON object or not.
 * @returns {JSON}
 */
ApiRun.prototype.ToJSON = function(bWriteStyles){ return new JSON(); };

/**
 * Adds a comment to the current run.
 * <note>Please note that this run must be in the document.</note>
 * @memberof ApiRun
 * @param {string} sText - The comment text.
 * @param {string} [sAuthor] - The author's name.
 * @param {string} [sUserId] - The user ID of the comment author.
 * @returns {ApiComment} - Returns null if the comment was not added.
 */
ApiRun.prototype.AddComment = function(sText, sAuthor, sUserId){ return new ApiComment(); };

/**
 * Returns a text from the text run.
 * @memberof ApiRun
 * @param {object} oPr - The resulting string display properties.
 * @param {string} [oPr.NewLineSeparator='\r'] - Defines how the line separator will be specified in the resulting string. Any symbol can be used. The default separator is "\r".
 * @param {string} [oPr.TabSymbol='\t'] - Defines how the tab will be specified in the resulting string. Any symbol can be used. The default symbol is "\t".
 * @returns {string}
 */
ApiRun.prototype.GetText = function(oPr){ return ""; };

/**
 * Moves a cursor to a specified position of the current text run.
 * If the current run is not assigned to any document part, then <b>false</b> is returned. Otherwise, this method returns <b>true</b>.
 * If there is any selection in the document, it will be removed.
 * @memberof ApiRun
 * @param {number} [nPos=0] - Desired cursor position.
 * @returns {boolean}
 * @since 8.2.0
 */
ApiRun.prototype.MoveCursorToPos = function(nPos){ return true; };

/**
 * Returns a type of the ApiSection class.
 * @memberof ApiSection
 * @returns {"section"}
 */
ApiSection.prototype.GetClassType = function(){ return ""; };

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
 * Specifies a type of the current section. The section type defines how the contents of the current 
 * section are placed relative to the previous section.
 * @memberof ApiSection
 * @param {SectionBreakType} sType - The section break type.
 * @returns {boolean}
 */
ApiSection.prototype.SetType = function(sType){ return true; };

/**
 * Returns the section break type.
 * @memberof ApiSection
 * @returns {SectionBreakType} - The section break type.
 * @since 8.2.0
 */
ApiSection.prototype.GetType = function(){ return new SectionBreakType(); };

/**
 * Specifies that all the text columns in the current section are of equal width.
 * @memberof ApiSection
 * @param {number} nCount - Number of columns.
 * @param {twips} nSpace - Distance between columns measured in twentieths of a point (1/1440 of an inch).
 * @returns {boolean}
 */
ApiSection.prototype.SetEqualColumns = function(nCount, nSpace){ return true; };

/**
 * Specifies that all the columns in the current section have the different widths. Number of columns is equal 
 * to the length of the aWidth array. The length of the aSpaces array MUST BE equal to (aWidth.length - 1).
 * @memberof ApiSection
 * @param {twips[]} aWidths - An array of column width values measured in twentieths of a point (1/1440 of an inch).
 * @param {twips[]} aSpaces - An array of distance values between the columns measured in twentieths of a point (1/1440 of an inch).
 * @returns {boolean}
 */
ApiSection.prototype.SetNotEqualColumns = function(aWidths, aSpaces){ return true; };

/**
 * Specifies the properties (size and orientation) for all the pages in the current section.
 * @memberof ApiSection
 * @param {twips} nWidth - The page width measured in twentieths of a point (1/1440 of an inch).
 * @param {twips} nHeight - The page height measured in twentieths of a point (1/1440 of an inch).
 * @param {boolean} [isPortrait=false] - Specifies the orientation of all the pages in this section (if set to true, then the portrait orientation is chosen).
 * @returns {boolean}
 */
ApiSection.prototype.SetPageSize = function(nWidth, nHeight, isPortrait){ return true; };

/**
 * Gets page height for current section.
 * @memberof ApiSection
 * @returns {twips}
 */
ApiSection.prototype.GetPageHeight = function(){ return new twips(); };

/**
 * Gets page width for current section.
 * @memberof ApiSection
 * @returns {twips}
 */
ApiSection.prototype.GetPageWidth = function(){ return new twips(); };

/**
 * Specifies the page margins for all the pages in this section.
 * @memberof ApiSection
 * @param {twips} nLeft - The left margin width measured in twentieths of a point (1/1440 of an inch).
 * @param {twips} nTop - The top margin height measured in twentieths of a point (1/1440 of an inch).
 * @param {twips} nRight - The right margin width measured in twentieths of a point (1/1440 of an inch).
 * @param {twips} nBottom - The bottom margin height measured in twentieths of a point (1/1440 of an inch).
 * @returns {boolean}
 */
ApiSection.prototype.SetPageMargins = function(nLeft, nTop, nRight, nBottom){ return true; };

/**
 * Gets the left page margin for all pages in this section.
 * @memberof ApiSection
 * @returns {twips}
 */
ApiSection.prototype.GetPageMarginLeft = function(){ return new twips(); };

/**
 * Gets the top page margin for all pages in this section.
 * @memberof ApiSection
 * @returns {twips}
 */
ApiSection.prototype.GetPageMarginTop = function(){ return new twips(); };

/**
 * Gets the right page margin for all pages in this section.
 * @memberof ApiSection
 * @returns {twips}
 */
ApiSection.prototype.GetPageMarginRight = function(){ return new twips(); };

/**
 * Gets the bottom page margin for all pages in this section.
 * @memberof ApiSection
 * @returns {twips}
 */
ApiSection.prototype.GetPageMarginBottom = function(){ return new twips(); };

/**
 * Specifies the distance from the top edge of the page to the top edge of the header.
 * @memberof ApiSection
 * @param {twips} nDistance - The distance from the top edge of the page to the top edge of the header measured in twentieths of a point (1/1440 of an inch).
 * @returns {boolean}
 */
ApiSection.prototype.SetHeaderDistance = function(nDistance){ return true; };

/**
 * Specifies the distance from the top edge of the page to the top edge of the header.
 * @memberof ApiSection
 * @returns {twips}
 */
ApiSection.prototype.GetHeaderDistance = function(){ return new twips(); };

/**
 * Specifies the distance from the bottom edge of the page to the bottom edge of the footer.
 * @memberof ApiSection
 * @param {twips} nDistance - The distance from the bottom edge of the page to the bottom edge of the footer measured
 * in twentieths of a point (1/1440 of an inch).
 * @returns {boolean}
 */
ApiSection.prototype.SetFooterDistance = function(nDistance){ return true; };

/**
 * Gets the distance from the bottom edge of the page to the bottom edge of the footer.
 * @memberof ApiSection
 * @returns {twips}
 */
ApiSection.prototype.GetFooterDistance = function(){ return new twips(); };

/**
 * Returns the content for the specified header type.
 * @memberof ApiSection
 * @param {HdrFtrType} sType - Header type to get the content from.
 * @param {boolean} [isCreate=false] - Specifies whether to create a new header or not with the specified header type in case
 * no header with such a type could be found in the current section.
 * @returns {ApiDocumentContent}
 */
ApiSection.prototype.GetHeader = function(sType, isCreate){ return new ApiDocumentContent(); };

/**
 * Removes the header of the specified type from the current section. After removal, the header will be inherited from
 * the previous section, or if this is the first section in the document, no header of the specified type will be presented.
 * @memberof ApiSection
 * @param {HdrFtrType} sType - Header type to be removed.
 * @returns {boolean}
 */
ApiSection.prototype.RemoveHeader = function(sType){ return true; };

/**
 * Returns the content for the specified footer type.
 * @memberof ApiSection
 * @param {HdrFtrType} sType - Footer type to get the content from.
 * @param {boolean} [isCreate=false] - Specifies whether to create a new footer or not with the specified footer type in case
 * no footer with such a type could be found in the current section.
 * @returns {ApiDocumentContent}
 */
ApiSection.prototype.GetFooter = function(sType, isCreate){ return new ApiDocumentContent(); };

/**
 * Removes the footer of the specified type from the current section. After removal, the footer will be inherited from 
 * the previous section, or if this is the first section in the document, no footer of the specified type will be presented.
 * @memberof ApiSection
 * @param {HdrFtrType} sType - Footer type to be removed.
 * @returns {boolean}
 */
ApiSection.prototype.RemoveFooter = function(sType){ return true; };

/**
 * Specifies whether the current section in this document has the different header and footer for the section first page.
 * @memberof ApiSection
 * @param {boolean} isTitlePage - If true, the first page of the section will have header and footer that will differ from the other pages of the same section.
 * @returns {boolean}
 */
ApiSection.prototype.SetTitlePage = function(isTitlePage){ return true; };

/**
 * Returns the next section if exists.
 * @memberof ApiSection
 * @returns {ApiSection | null} - returns null if section is last.
 */
ApiSection.prototype.GetNext = function(){ return new ApiSection(); };

/**
 * Returns the previous section if exists.
 * @memberof ApiSection
 * @returns {ApiSection | null} - returns null if section is first.
 */
ApiSection.prototype.GetPrevious = function(){ return new ApiSection(); };

/**
 * Converts the ApiSection object into the JSON object.
 * @memberof ApiSection
 * @param {boolean} bWriteNumberings - Specifies if the used numberings will be written to the JSON object or not.
 * @param {boolean} bWriteStyles - Specifies if the used styles will be written to the JSON object or not.
 * @returns {JSON}
 */
ApiSection.prototype.ToJSON = function(bWriteNumberings, bWriteStyles){ return new JSON(); };

/**
 * Sets the start page number for the specified section.
 * @memberof ApiSection
 * @param {number} nStartNumber - The start page number.
 * @returns {boolean}
 * @since 8.3.0
 */
ApiSection.prototype.SetStartPageNumber = function(nStartNumber){ return true; };

/**
 * Returns the start page number of the specified section.
 * @memberof ApiSection
 * @returns {number}
 * @since 8.3.0
 */
ApiSection.prototype.GetStartPageNumber = function(){ return 0; };

/**
 * Returns a type of the ApiTable class.
 * @memberof ApiTable
 * @returns {"table"}
 */
ApiTable.prototype.GetClassType = function(){ return ""; };

/**
 * Returns a number of rows in the current table.
 * @memberof ApiTable
 * @returns {number}
 */
ApiTable.prototype.GetRowsCount = function(){ return 0; };

/**
 * Returns a table row by its position in the table.
 * @memberof ApiTable
 * @param {number} nPos - The row position within the table.
 * @returns {ApiTableRow | null} - returns null if param is invalid.
 */
ApiTable.prototype.GetRow = function(nPos){ return new ApiTableRow(); };

/**
 * Returns a cell by its position.
 * @memberof ApiTable
 * @param {number} nRow - The row position in the current table where the specified cell is placed.
 * @param {number} nCell - The cell position in the current table.
 * @returns {ApiTableCell | null} - returns null if params are invalid.
 */
ApiTable.prototype.GetCell = function(nRow, nCell){ return new ApiTableCell(); };

/**
 * Merges an array of cells. If the merge is done successfully, it will return the resulting merged cell, otherwise the result will be "null".
 * <note>The number of cells in any row and the number of rows in the current table may be changed.</note>
 * @memberof ApiTable
 * @param {ApiTableCell[]} aCells - The array of cells to be merged.
 * @returns {ApiTableCell}
 */
ApiTable.prototype.MergeCells = function(aCells){ return new ApiTableCell(); };

/**
 * Sets a style to the current table.
 * @memberof ApiTable
 * @param {ApiStyle} oStyle - The style which will be applied to the current table.
 * @returns {boolean} - returns false if param is invalid.
 */
ApiTable.prototype.SetStyle = function(oStyle){ return true; };

/**
 * Specifies the conditional formatting components of the referenced table style (if one exists) 
 * which will be applied to the set of table rows with the current table-level property exceptions. A table style 
 * can specify up to six different optional conditional formats, for example, different formatting for the first column, 
 * which then can be applied or omitted from individual table rows in the parent table.
 * 
 * The default setting is to apply the row and column band formatting, but not the first row, last row, first 
 * column, or last column formatting.
 * @memberof ApiTable
 * @param {boolean} isFirstColumn - Specifies that the first column conditional formatting will be applied to the table.
 * @param {boolean} isFirstRow - Specifies that the first row conditional formatting will be applied to the table.
 * @param {boolean} isLastColumn - Specifies that the last column conditional formatting will be applied to the table.
 * @param {boolean} isLastRow - Specifies that the last row conditional formatting will be applied to the table.
 * @param {boolean} isHorBand - Specifies that the horizontal band conditional formatting will not be applied to the table.
 * @param {boolean} isVerBand - Specifies that the vertical band conditional formatting will not be applied to the table.
 * @returns {boolean}
 */
ApiTable.prototype.SetTableLook = function(isFirstColumn, isFirstRow, isLastColumn, isLastRow, isHorBand, isVerBand){ return true; };

/**
 * Splits the cell into a given number of rows and columns.
 * @memberof ApiTable
 * @param {ApiTableCell} [oCell] - The cell which will be split.
 * @param {Number} [nRow=1] - Count of rows into which the cell will be split.
 * @param {Number} [nCol=1] - Count of columns into which the cell will be split.
 * @returns {ApiTable | null} - returns null if can't split.
 */
ApiTable.prototype.Split = function(oCell, nRow, nCol){ return new ApiTable(); };

/**
 * Adds a new row to the current table.
 * @memberof ApiTable
 * @param {ApiTableCell} [oCell] - The cell after which a new row will be added. If not specified, a new row will
 * be added at the end of the table.
 * @param {boolean} [isBefore=false] - Adds a new row before (false) or after (true) the specified cell. If no cell is specified, then
 * this parameter will be ignored.
 * @returns {ApiTableRow}
 */
ApiTable.prototype.AddRow = function(oCell, isBefore){ return new ApiTableRow(); };

/**
 * Adds the new rows to the current table.
 * @memberof ApiTable
 * @param {ApiTableCell} [oCell] - The cell after which the new rows will be added. If not specified, the new rows will
 * be added at the end of the table.
 * @param {Number} nCount - Count of rows to be added.
 * @param {boolean} [isBefore=false] - Adds the new rows before (false) or after (true) the specified cell. If no cell is specified, then
 * this parameter will be ignored.
 * @returns {ApiTable}
 */
ApiTable.prototype.AddRows = function(oCell, nCount, isBefore){ return new ApiTable(); };

/**
 * Adds a new column to the current table.
 * @memberof ApiTable
 * @param {ApiTableCell} [oCell] - The cell after which a new column will be added. If not specified, a new column will be added at the end of the table.
 * @param {boolean} [isBefore=false] - Adds a new column before (false) or after (true) the specified cell. If no cell is specified,
 * then this parameter will be ignored.
 * @returns {boolean}
 */
ApiTable.prototype.AddColumn = function(oCell, isBefore){ return true; };

/**
 * Adds the new columns to the current table.
 * @memberof ApiTable
 * @param {ApiTableCell} [oCell] - The cell after which the new columns will be added. If not specified, the new columns will be added at the end of the table.
 * @param {Number} nCount - Count of columns to be added.
 * @param {boolean} [isBefore=false] - Adds the new columns before (false) or after (true) the specified cell. If no cell is specified,
 * then this parameter will be ignored.
 * @returns {ApiTable}
 */
ApiTable.prototype.AddColumns = function(oCell, nCount, isBefore){ return new ApiTable(); };

/**
 * Adds a paragraph or a table or a blockLvl content control using its position in the cell.
 * @memberof ApiTable
 * @param {ApiTableCell} oCell - The cell where the specified element will be added.
 * @param {number} nPos - The position in the cell where the specified element will be added.
 * @param {DocumentElement} oElement - The document element which will be added at the current position.
 * @returns {boolean}
 */
ApiTable.prototype.AddElement = function(oCell, nPos, oElement){ return true; };

/**
 * Removes a table row with a specified cell.
 * @memberof ApiTable
 * @param {ApiTableCell} oCell - The cell which is placed in the row that will be removed.
 * @returns {boolean} Is the table empty after removing.
 */
ApiTable.prototype.RemoveRow = function(oCell){ return true; };

/**
 * Removes a table column with a specified cell.
 * @memberof ApiTable
 * @param {ApiTableCell} oCell - The cell which is placed in the column that will be removed.
 * @returns {boolean} Is the table empty after removing.
 */
ApiTable.prototype.RemoveColumn = function(oCell){ return true; };

/**
 * Creates a copy of the current table.
 * @memberof ApiTable
 * @returns {ApiTable}
 */
ApiTable.prototype.Copy = function(){ return new ApiTable(); };

/**
 * Selects the current table.
 * @memberof ApiTable
 * @returns {boolean}
 */
ApiTable.prototype.Select = function(){ return true; };

/**
 * Returns a Range object that represents the part of the document contained in the specified table.
 * @memberof ApiTable
 * @param {Number} Start - Start position index in the current element.
 * @param {Number} End - End position index in the current element.
 * @returns {ApiRange} 
 */
ApiTable.prototype.GetRange = function(Start, End){ return new ApiRange(); };

/**
 * Sets the horizontal alignment to the table.
 * @memberof ApiTable
 * @param {String} sType - Horizontal alignment type: may be "left" or "center" or "right".
 * @returns {boolean} - returns false if param is invalid.
 */
ApiTable.prototype.SetHAlign = function(sType){ return true; };

/**
 * Sets the vertical alignment to the table.
 * @param {String} sType - Vertical alignment type: may be "top" or "center" or "bottom".
 * @returns {boolean} - returns false if param is invalid.
 */
ApiTable.prototype.SetVAlign = function(sType){ return true; };

/**
 * Sets the table paddings.
 * If table is inline, then only left padding is applied.
 * @memberof ApiTable
 * @param {Number} nLeft - Left padding.
 * @param {Number} nTop - Top padding.
 * @param {Number} nRight - Right padding.
 * @param {Number} nBottom - Bottom padding.
 * @returns {boolean} - returns true.
 */
ApiTable.prototype.SetPaddings = function(nLeft, nTop, nRight, nBottom){ return true; };

/**
 * Sets the table wrapping style.
 * @memberof ApiTable
 * @param {boolean} isFlow - Specifies if the table is inline or not.
 * @returns {boolean} - returns false if param is invalid.
 */
ApiTable.prototype.SetWrappingStyle = function(isFlow){ return true; };

/**
 * Returns a content control that contains the current table.
 * @memberof ApiTable
 * @returns {ApiBlockLvlSdt | null} - return null is parent content control doesn't exist.
 */
ApiTable.prototype.GetParentContentControl = function(){ return new ApiBlockLvlSdt(); };

/**
 * Wraps the current table object with a content control.
 * @memberof ApiTable
 * @param {number} nType - Defines if this method returns the ApiBlockLvlSdt (nType === 1) or ApiTable (any value except 1) object.
 * @returns {ApiTable | ApiBlockLvlSdt}  
 */
ApiTable.prototype.InsertInContentControl = function(nType){ return new ApiTable(); };

/**
 * Returns a table that contains the current table.
 * @memberof ApiTable
 * @returns {ApiTable | null} - returns null if parent table doesn't exist.  
 */
ApiTable.prototype.GetParentTable = function(){ return new ApiTable(); };

/**
 * Returns an array of tables that represents all the tables nested within the specified table.
 * @memberof ApiTable
 * @returns {ApiTable[]}
 */
ApiTable.prototype.GetTables = function(){ return [new ApiTable()]; };

/**
 * Returns a table cell that contains the current table.
 * @memberof ApiTable
 * @returns {ApiTableCell | null} - returns null if parent cell doesn't exist.  
 */
ApiTable.prototype.GetParentTableCell = function(){ return new ApiTableCell(); };

/**
 * Deletes the current table. 
 * @memberof ApiTable
 * @returns {boolean} - returns false if parent of table doesn't exist.
 */
ApiTable.prototype.Delete = function(){ return true; };

/**
 * Clears the content from the table.
 * @memberof ApiTable
 * @returns {boolean} - returns true.
 */
ApiTable.prototype.Clear = function(){ return true; };

/**
 * Searches for a scope of a table object. The search results are a collection of ApiRange objects.
 * @memberof ApiTable
 * @param {string} sText - Search string.
 * @param {boolean} isMatchCase - Case sensitive or not.
 * @returns {ApiRange[]}  
 */
ApiTable.prototype.Search = function(sText, isMatchCase){ return [new ApiRange()]; };

/**
 * Applies the text settings to the entire contents of the table.
 * @memberof ApiTable
 * @param {ApiTextPr} oTextPr - The text properties that will be set to the current table.
 * @returns {boolean} - returns true.
 */
ApiTable.prototype.SetTextPr = function(oTextPr){ return true; };

/**
 * Sets the background color to all cells in the current table.
 * @memberof ApiTable
 * @param {byte} r - Red color component value.
 * @param {byte} g - Green color component value.
 * @param {byte} b - Blue color component value.
 * @param {boolean} bNone - Defines that background color will not be set.
 * @returns {boolean}
 */
ApiTable.prototype.SetBackgroundColor = function(r, g, b, bNone){ return true; };

/**
 * Converts the ApiTable object into the JSON object.
 * @memberof ApiTable
 * @param {boolean} bWriteNumberings - Specifies if the used numberings will be written to the JSON object or not.
 * @param {boolean} bWriteStyles - Specifies if the used styles will be written to the JSON object or not.
 * @returns {JSON}
 */
ApiTable.prototype.ToJSON = function(bWriteNumberings, bWriteStyles){ return new JSON(); };

/**
 * Returns the table position within its parent element.
 * @memberof ApiTable
 * @returns {Number} - returns -1 if the table parent doesn't exist. 
 */
ApiTable.prototype.GetPosInParent = function(){ return 0; };

/**
 * Replaces the current table with a new element.
 * @memberof ApiTable
 * @param {DocumentElement} oElement - The element to replace the current table with.
 * @returns {boolean}
 */
ApiTable.prototype.ReplaceByElement = function(oElement){ return true; };

/**
 * Adds a comment to all contents of the current table.
 * <note>Please note that this table must be in the document.</note>
 * @memberof ApiTable
 * @param {string} sText - The comment text.
 * @param {string} [sAuthor] - The author's name.
 * @param {string} [sUserId] - The user ID of the comment author.
 * @returns {ApiComment} - Returns null if the comment was not added.
 */
ApiTable.prototype.AddComment = function(sText, sAuthor, sUserId){ return new ApiComment(); };

/**
 * Adds a caption paragraph after (or before) the current table.
 * <note>Please note that the current table must be in the document (not in the footer/header).
 * And if the current table is placed in a shape, then a caption is added after (or before) the parent shape.</note>
 * @memberof ApiTable
 * @param {string} sAdditional - The additional text.
 * @param {CaptionLabel | String} [sLabel="Table"] - The caption label.
 * @param {boolean} [bExludeLabel=false] - Specifies whether to exclude the label from the caption.
 * @param {CaptionNumberingFormat} [sNumberingFormat="Arabic"] - The possible caption numbering format.
 * @param {boolean} [bBefore=false] - Specifies whether to insert the caption before the current table (true) or after (false) (after/before the shape if it is placed in the shape).
 * @param {Number} [nHeadingLvl=undefined] - The heading level (used if you want to specify the chapter number).
 * <note>If you want to specify "Heading 1", then nHeadingLvl === 0 and etc.</note>
 * @param {CaptionSep} [sCaptionSep="hyphen"] - The caption separator (used if you want to specify the chapter number).
 * @returns {boolean}
 */
ApiTable.prototype.AddCaption = function(sAdditional, sLabel, bExludeLabel, sNumberingFormat, bBefore, nHeadingLvl, sCaptionSep){ return true; };

/**
 * Returns a type of the ApiTableRow class.
 * @memberof ApiTableRow
 * @returns {"tableRow"}
 */
ApiTableRow.prototype.GetClassType = function(){ return ""; };

/**
 * Returns a number of cells in the current row.
 * @memberof ApiTableRow
 * @returns {number}
 */
ApiTableRow.prototype.GetCellsCount = function(){ return 0; };

/**
 * Returns a cell by its position.
 * @memberof ApiTableRow
 * @param {number} nPos - The cell position in the current row.
 * @returns {ApiTableCell}
 */
ApiTableRow.prototype.GetCell = function(nPos){ return new ApiTableCell(); };

/**
 * Returns the current row index.
 * @memberof ApiTableRow
 * @returns {Number}
 */
ApiTableRow.prototype.GetIndex = function(){ return 0; };

/**
 * Returns the parent table of the current row.
 * @memberof ApiTableRow
 * @returns {ApiTable | null} - returns null if parent table doesn't exist.
 */
ApiTableRow.prototype.GetParentTable = function(){ return new ApiTable(); };

/**
 * Returns the next row if exists.
 * @memberof ApiTableRow
 * @returns {ApiTableRow | null} - returns null if row is last.
 */
ApiTableRow.prototype.GetNext = function(){ return new ApiTableRow(); };

/**
 * Returns the previous row if exists.
 * @memberof ApiTableRow
 * @returns {ApiTableRow | null} - returns null if row is first.
 */
ApiTableRow.prototype.GetPrevious = function(){ return new ApiTableRow(); };

/**
 * Adds the new rows to the current table.
 * @memberof ApiTableRow
 * @param {Number} nCount - Count of rows to be added.
 * @param {boolean} [isBefore=false] - Specifies if the rows will be added before or after the current row. 
 * @returns {ApiTable | null} - returns null if parent table doesn't exist.
 */
ApiTableRow.prototype.AddRows = function(nCount, isBefore){ return new ApiTable(); };

/**
 * Merges the cells in the current row. 
 * @memberof ApiTableRow
 * @returns {ApiTableCell | null} - return null if can't merge.
 */
ApiTableRow.prototype.MergeCells = function(){ return new ApiTableCell(); };

/**
 * Clears the content from the current row.
 * @memberof ApiTableRow
 * @returns {boolean} - returns false if parent table doesn't exist.
 */
ApiTableRow.prototype.Clear = function(){ return true; };

/**
 * Removes the current table row.
 * @memberof ApiTableRow
 * @returns {boolean} - return false if parent table doesn't exist.
 */
ApiTableRow.prototype.Remove = function(){ return true; };

/**
 * Sets the text properties to the current row.
 * @memberof ApiTableRow
 * @param {ApiTextPr} oTextPr - The text properties that will be set to the current row.
 * @returns {boolean} - returns false if parent table doesn't exist or param is invalid.
 */
ApiTableRow.prototype.SetTextPr = function(oTextPr){ return true; };

/**
 * Searches for a scope of a table row object. The search results are a collection of ApiRange objects.
 * @memberof ApiTableRow
 * @param {string} sText - Search string.
 * @param {boolean} isMatchCase - Case sensitive or not.
 * @returns {ApiRange[]}
 */
ApiTableRow.prototype.Search = function(sText, isMatchCase){ return [new ApiRange()]; };

/**
 * Sets the background color to all cells in the current table row.
 * @memberof ApiTableRow
 * @param {byte} r - Red color component value.
 * @param {byte} g - Green color component value.
 * @param {byte} b - Blue color component value.
 * @param {boolean} bNone - Defines that background color will not be set.
 * @returns {boolean}
 */
ApiTableRow.prototype.SetBackgroundColor = function(r, g, b, bNone){ return true; };

/**
 * Returns a type of the ApiTableCell class.
 * @memberof ApiTableCell
 * @returns {"tableCell"}
 */
ApiTableCell.prototype.GetClassType = function(){ return ""; };

/**
 * Returns the current cell content.
 * @memberof ApiTableCell
 * @returns {ApiDocumentContent}
 */
ApiTableCell.prototype.GetContent = function(){ return new ApiDocumentContent(); };

/**
 * Returns the current cell index.
 * @memberof ApiTableCell
 * @returns {Number}
 */
ApiTableCell.prototype.GetIndex = function(){ return 0; };

/**
 * Returns an index of the parent row.
 * @memberof ApiTableCell
 * @returns {number}
 */
ApiTableCell.prototype.GetRowIndex = function(){ return 0; };

/**
 * Returns a parent row of the current cell.
 * @memberof ApiTableCell
 * @returns {ApiTableRow | null} - returns null if parent row doesn't exist.
 */
ApiTableCell.prototype.GetParentRow = function(){ return new ApiTableRow(); };

/**
 * Returns a parent table of the current cell.
 * @memberof ApiTableCell
 * @returns {ApiTable | null} - returns null if parent table doesn't exist.
 */
ApiTableCell.prototype.GetParentTable = function(){ return new ApiTable(); };

/**
 * Adds the new rows to the current table.
 * @memberof ApiTableCell
 * @param {Number} nCount - Count of rows to be added.
 * @param {boolean} [isBefore=false] - Specifies if the new rows will be added before or after the current cell. 
 * @returns {ApiTable | null} - returns null if parent table doesn't exist.
 */
ApiTableCell.prototype.AddRows = function(nCount, isBefore){ return new ApiTable(); };

/**
 * Adds the new columns to the current table.
 * @memberof ApiTableCell
 * @param {Number} nCount - Count of columns to be added.
 * @param {boolean} [isBefore=false] - Specifies if the new columns will be added before or after the current cell. 
 * @returns {ApiTable | null} - returns null if parent table doesn't exist.
 */
ApiTableCell.prototype.AddColumns = function(nCount, isBefore){ return new ApiTable(); };

/**
 * Removes a column containing the current cell.
 * @memberof ApiTableCell
 * @returns {boolean} - returns false if table doen't exist
 */
ApiTableCell.prototype.RemoveColumn = function(){ return true; };

/**
 * Removes a row containing the current cell.
 * @memberof ApiTableCell
 * @returns {boolean} Is the table empty after removing.
 */
ApiTableCell.prototype.RemoveRow = function(){ return true; };

/**
 * Searches for a scope of a table cell object. The search results are a collection of ApiRange objects.
 * @memberof ApiTableCell
 * @param {string} sText - Search string.
 * @param {boolean} isMatchCase - Case sensitive or not.
 * @returns {ApiRange[]}  
 */
ApiTableCell.prototype.Search = function(sText, isMatchCase){ return [new ApiRange()]; };

/**
 * Returns the next cell if exists.
 * @memberof ApiTableCell
 * @returns {ApiTableCell | null} - returns null if cell is last.
 */
ApiTableCell.prototype.GetNext = function(){ return new ApiTableCell(); };

/**
 * Returns the previous cell if exists.
 * @memberof ApiTableCell
 * @returns {ApiTableCell | null} - returns null is cell is first. 
 */
ApiTableCell.prototype.GetPrevious = function(){ return new ApiTableCell(); };

/**
 * Splits the cell into a given number of rows and columns.
 * @memberof ApiTableCell
 * @param {Number} [nRow=1] - Count of rows into which the cell will be split.
 * @param {Number} [nCol=1] - Count of columns into which the cell will be split.
 * @returns {ApiTable | null} - returns null if parent table doesn't exist.
 */
ApiTableCell.prototype.Split = function(nRow, nCol){ return new ApiTable(); };

/**
 * Sets the cell properties to the current cell.
 * @memberof ApiTableCell
 * @param {ApiTableCellPr} oApiTableCellPr - The properties that will be set to the current table cell.
 * @returns {boolean} - returns false if param is invalid.
 */
ApiTableCell.prototype.SetCellPr = function(oApiTableCellPr){ return true; };

/**
 * Applies the text settings to the entire contents of the current cell.
 * @memberof ApiTableCell
 * @param {ApiTextPr} oTextPr - The properties that will be set to the current table cell text.
 * @returns {boolean} - returns false if param is invalid.
 */
ApiTableCell.prototype.SetTextPr = function(oTextPr){ return true; };

/**
 * Clears the content from the current cell.
 * @memberof ApiTableCell
 * @returns {boolean} - returns false if parent row is invalid.
 */
ApiTableCell.prototype.Clear = function(){ return true; };

/**
 * Adds a paragraph or a table or a blockLvl content control using its position in the cell.
 * @memberof ApiTableCell
 * @param {number} nPos - The position where the current element will be added.
 * @param {DocumentElement} oElement - The document element which will be added at the current position.
 * @returns {boolean} - returns false if oElement is invalid.
 */
ApiTableCell.prototype.AddElement = function(nPos, oElement){ return true; };

/**
 * Sets the background color to the current table cell.
 * @memberof ApiTableCell
 * @param {byte} r - Red color component value.
 * @param {byte} g - Green color component value.
 * @param {byte} b - Blue color component value.
 * @param {boolean} bNone - Defines that background color will not be set.
 * @returns {boolean}
 */
ApiTableCell.prototype.SetBackgroundColor = function(r, g, b, bNone){ return true; };

/**
 * Sets the background color to all cells in the column containing the current cell.
 * @memberof ApiTableCell
 * @param {byte} r - Red color component value.
 * @param {byte} g - Green color component value.
 * @param {byte} b - Blue color component value.
 * @param {boolean} bNone - Defines that background color will not be set.
 * @returns {boolean}
 */
ApiTableCell.prototype.SetColumnBackgroundColor = function(r, g, b, bNone){ return true; };

/**
 * Returns a type of the ApiStyle class.
 * @memberof ApiStyle
 * @returns {"style"}
 */
ApiStyle.prototype.GetClassType = function(){ return ""; };

/**
 * Returns a name of the current style.
 * @memberof ApiStyle
 * @returns {string}
 */
ApiStyle.prototype.GetName = function(){ return ""; };

/**
 * Sets a name of the current style.
 * @memberof ApiStyle
 * @param {string} sStyleName - The name which will be used for the current style.
 * @returns {boolean}
 */
ApiStyle.prototype.SetName = function(sStyleName){ return true; };

/**
 * Returns a type of the current style.
 * @memberof ApiStyle
 * @returns {StyleType}
 */
ApiStyle.prototype.GetType = function(){ return new StyleType(); };

/**
 * Returns the text properties of the current style.
 * @memberof ApiStyle
 * @returns {ApiTextPr}
 */
ApiStyle.prototype.GetTextPr = function(){ return new ApiTextPr(); };

/**
 * Sets the text properties to the current style.
 * @memberof ApiStyle
 * @param {ApiTextPr} oTextPr - The properties that will be set.
 * @returns {ApiStyle} - this
 */
ApiStyle.prototype.SetTextPr = function(oTextPr){ return new ApiStyle(); };

/**
 * Returns the paragraph properties of the current style.
 * @memberof ApiStyle
 * @returns {ApiParaPr}
 */
ApiStyle.prototype.GetParaPr = function(){ return new ApiParaPr(); };

/**
 * Sets the paragraph properties to the current style.
 * @memberof ApiStyle
 * @param {ApiParaPr} oParaPr - The properties that will be set.
 * @returns {ApiStyle} - this
 */
ApiStyle.prototype.SetParaPr = function(oParaPr){ return new ApiStyle(); };

/**
 * Returns the table properties of the current style.
 * @memberof ApiStyle
 * @returns {ApiTablePr} If the type of this style is not a <code>"table"</code> then it will return
 *     <code>null</code>.
 */
ApiStyle.prototype.GetTablePr = function(){ return new ApiTablePr(); };

/**
 * Sets the table properties to the current style.
 * @memberof ApiStyle
 * @param {ApiTablePr} oTablePr - The properties that will be set.
 * @returns {ApiStyle} - this
 */
ApiStyle.prototype.SetTablePr = function(oTablePr){ return new ApiStyle(); };

/**
 * Returns the table row properties of the current style.
 * @memberof ApiStyle
 * @returns {ApiTableRowPr} If the type of this style is not a <code>"table"</code> then it will return
 *     <code>null</code>.
 */
ApiStyle.prototype.GetTableRowPr = function(){ return new ApiTableRowPr(); };

/**
 * Sets the table row properties to the current style.
 * @memberof ApiStyle
 * @param {ApiTableRowPr} oTableRowPr - The properties that will be set.
 * @returns {ApiStyle} - this
 */
ApiStyle.prototype.SetTableRowPr = function(oTableRowPr){ return new ApiStyle(); };

/**
 * Returns the table cell properties of the current style.
 * @memberof ApiStyle
 * @returns {ApiTableCellPr}
 */
ApiStyle.prototype.GetTableCellPr = function(){ return new ApiTableCellPr(); };

/**
 * Sets the table cell properties to the current style.
 * @memberof ApiStyle
 * @param {ApiTableCellPr} oTableCellPr - The properties that will be set.
 * @returns {ApiStyle} - this
 */
ApiStyle.prototype.SetTableCellPr = function(oTableCellPr){ return new ApiStyle(); };

/**
 * Specifies the reference to the parent style which this style inherits from in the style hierarchy.
 * @memberof ApiStyle
 * @param {ApiStyle} oStyle - The parent style which the style inherits properties from.
 * @returns {boolean}
 */
ApiStyle.prototype.SetBasedOn = function(oStyle){ return true; };

/**
 * Returns a set of formatting properties which will be conditionally applied to the parts of a table that match the 
 * requirement specified in the sType parameter.
 * @memberof ApiStyle
 * @param {TableStyleOverrideType} [sType="wholeTable"] - The table part which the formatting properties must be applied to.
 * @returns {ApiTableStylePr}
 */
ApiStyle.prototype.GetConditionalTableStyle = function(sType){ return new ApiTableStylePr(); };

/**
 * Specifies formatting properties that will be conditionally applied to parts of the table that match the oTableStylePr type. 
 * @memberof ApiStyle
 * @param {ApiTableStylePr} oTableStylePr - The table style properties.
 * @returns {ApiStyle} - this
 */
ApiStyle.prototype.SetConditionalTableStyle = function(oTableStylePr){ return new ApiStyle(); };

/**
 * Converts the ApiStyle object into the JSON object.
 * @memberof ApiStyle
 * @param {boolean} bWriteNumberings - Specifies if the used numberings will be written to the JSON object or not.
 * @returns {JSON}
 */
ApiStyle.prototype.ToJSON = function(bWriteNumberings){ return new JSON(); };

/**
 * Returns a type of the ApiTextPr class.
 * @memberof ApiTextPr
 * @returns {"textPr"}
 */
ApiTextPr.prototype.GetClassType = function(){ return ""; };

/**
 * The text style base method.
 * <note>This method is not used by itself, as it only forms the basis for the {@link ApiRun#SetStyle} method which sets
 * the selected or created style to the text.</note>
 * @memberof ApiTextPr
 * @param {ApiStyle} oStyle - The style which must be applied to the text character.
 * @returns {ApiTextPr} - this text properties.
 */
ApiTextPr.prototype.SetStyle = function(oStyle){ return new ApiTextPr(); };

/**
 * Gets the style of the current text properties.
 * @memberof ApiTextPr
 * @returns {ApiStyle} - The used style.
 * @since 8.1.0
 */
ApiTextPr.prototype.GetStyle = function(){ return new ApiStyle(); };

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
 * Sets the text color to the current text run in the RGB format.
 * @memberof ApiTextPr
 * @param {byte} r - Red color component value.
 * @param {byte} g - Green color component value.
 * @param {byte} b - Blue color component value.
 * @param {boolean} [isAuto=false] - If this parameter is set to "true", then r,g,b parameters will be ignored.
 * @returns {ApiTextPr} - this text properties.
 */
ApiTextPr.prototype.SetColor = function(r, g, b, isAuto){ return new ApiTextPr(); };

/**
 * Gets the RGB color from the current text properties.
 * @memberof ApiTextPr
 * @returns {ApiRGBColor}
 * @since 8.1.0
 */
ApiTextPr.prototype.GetColor = function(){ return new ApiRGBColor(); };

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
 * Gets the vertical alignment type from the current text properties.
 * @memberof ApiTextPr
 * @returns {string}
 * @since 8.1.0
 */
ApiTextPr.prototype.GetVertAlign = function(){ return ""; };

/**
 * Specifies a highlighting color which is added to the text properties and applied as a background to the contents of the current run/range/paragraph.
 * @memberof ApiTextPr
 * @param {highlightColor} sColor - Available highlight color.
 * @returns {ApiTextPr}
 */
ApiTextPr.prototype.SetHighlight = function(sColor){ return new ApiTextPr(); };

/**
 * Gets the highlight property from the current text properties.
 * @memberof ApiTextPr
 * @returns {string}
 * @since 8.1.0
 */
ApiTextPr.prototype.GetHighlight = function(){ return ""; };

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
 * Specifies an amount by which text is raised or lowered for this run in relation to the default
 * baseline of the surrounding non-positioned text.
 * @memberof ApiTextPr
 * @param {hps} nPosition - Specifies a positive (raised text) or negative (lowered text)
 * measurement in half-points (1/144 of an inch).
 * @returns {ApiTextPr} - this text properties.
 */
ApiTextPr.prototype.SetPosition = function(nPosition){ return new ApiTextPr(); };

/**
 * Gets the text position from the current text properties measured in half-points (1/144 of an inch).
 * @memberof ApiTextPr
 * @returns {hps}
 * @since 8.1.0
 */
ApiTextPr.prototype.GetPosition = function(){ return new hps(); };

/**
 * Specifies the languages which will be used to check spelling and grammar (if requested) when processing
 * the contents of the text run.
 * @memberof ApiTextPr
 * @param {string} sLangId - The possible value for this parameter is a language identifier as defined by
 * RFC 4646/BCP 47. Example: "en-CA".
 * @returns {ApiTextPr} - this text properties.
 */
ApiTextPr.prototype.SetLanguage = function(sLangId){ return new ApiTextPr(); };

/**
 * Gets the language from the current text properties.
 * @memberof ApiTextPr
 * @returns {string}
 * @since 8.1.0
 */
ApiTextPr.prototype.GetLanguage = function(){ return ""; };

/**
 * Specifies the shading applied to the contents of the current text run.
 * @memberof ApiTextPr
 * @param {ShdType} sType - The shading type applied to the contents of the current text run.
 * @param {byte} r - Red color component value.
 * @param {byte} g - Green color component value.
 * @param {byte} b - Blue color component value.
 * @returns {ApiTextPr} - this text properties.
 */
ApiTextPr.prototype.SetShd = function(sType, r, g, b){ return new ApiTextPr(); };

/**
 * Gets the text shading from the current text properties.
 * @memberof ApiTextPr
 * @returns {ApiRGBColor}
 * @since 8.1.0
 */
ApiTextPr.prototype.GetShd = function(){ return new ApiRGBColor(); };

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
 * Converts the ApiTextPr object into the JSON object.
 * @memberof ApiTextPr
 * @param {boolean} bWriteStyles - Specifies if the used styles will be written to the JSON object or not.
 * @returns {JSON}
 */
ApiTextPr.prototype.ToJSON = function(bWriteStyles){ return new JSON(); };

/**
 * Returns a type of the ApiParaPr class.
 * @memberof ApiParaPr
 * @returns {"paraPr"}
 */
ApiParaPr.prototype.GetClassType = function(){ return ""; };

/**
 * The paragraph style base method.
 * <note>This method is not used by itself, as it only forms the basis for the {@link ApiParagraph#SetStyle} method which sets the selected or created style for the paragraph.</note>
 * @memberof ApiParaPr
 * @param {ApiStyle} oStyle - The style of the paragraph to be set.
 * @returns {boolean}
 */
ApiParaPr.prototype.SetStyle = function(oStyle){ return true; };

/**
 * Returns the paragraph style method.
 * @memberof ApiParaPr
 * @returns {ApiStyle} - The style of the paragraph.
 */
ApiParaPr.prototype.GetStyle = function(){ return new ApiStyle(); };

/**
 * Specifies that any space before or after this paragraph set using the 
 * {@link ApiParaPr#SetSpacingBefore} or {@link ApiParaPr#SetSpacingAfter} spacing element, should not be applied when the preceding and 
 * following paragraphs are of the same paragraph style, affecting the top and bottom spacing respectively.
 * @memberof ApiParaPr
 * @param {boolean} isContextualSpacing - The true value will enable the paragraph contextual spacing.
 * @returns {boolean}
 */
ApiParaPr.prototype.SetContextualSpacing = function(isContextualSpacing){ return true; };

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
 * Specifies that when rendering the document using a page view, all lines of the current paragraph are maintained on a single page whenever possible.
 * @memberof ApiParaPr
 * @param {boolean} isKeepLines - The true value enables the option to keep lines of the paragraph on a single page.
 * @returns {boolean}
 */
ApiParaPr.prototype.SetKeepLines = function(isKeepLines){ return true; };

/**
 * Specifies that when rendering the document using a paginated view, the contents of the current paragraph are at least
 * partly rendered on the same page as the following paragraph whenever possible.
 * @memberof ApiParaPr
 * @param {boolean} isKeepNext - The true value enables the option to keep lines of the paragraph on the same
 * page as the following paragraph.
 * @returns {boolean}
 */
ApiParaPr.prototype.SetKeepNext = function(isKeepNext){ return true; };

/**
 * Specifies that when rendering the document using a paginated view, the contents of the current paragraph are rendered at
 * the beginning of a new page in the document.
 * @memberof ApiParaPr
 * @param {boolean} isPageBreakBefore - The true value enables the option to render the contents of the paragraph
 * at the beginning of a new page in the document.
 * @returns {boolean}
 */
ApiParaPr.prototype.SetPageBreakBefore = function(isPageBreakBefore){ return true; };

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
 * Specifies the shading applied to the contents of the paragraph.
 * @memberof ApiParaPr
 * @param {ShdType} sType - The shading type which will be applied to the contents of the current paragraph.
 * @param {byte} r - Red color component value.
 * @param {byte} g - Green color component value.
 * @param {byte} b - Blue color component value.
 * @param {boolean} [isAuto=false] - The true value disables paragraph contents shading.
 * @returns {boolean}
 */
ApiParaPr.prototype.SetShd = function(sType, r, g, b, isAuto){ return true; };

/**
 * Returns the shading applied to the contents of the paragraph.
 * @memberof ApiParaPr
 * @returns {ApiRGBColor}
 */
ApiParaPr.prototype.GetShd = function(){ return new ApiRGBColor(); };

/**
 * Specifies the border which will be displayed below a set of paragraphs which have the same paragraph border settings.
 * <note>The paragraphs of the same style going one by one are considered as a single block, so the border is added
 * to the whole block rather than to every paragraph in this block.</note>
 * @memberof ApiParaPr
 * @param {BorderType} sType - The border style.
 * @param {pt_8} nSize - The width of the current bottom border measured in eighths of a point.
 * @param {pt} nSpace - The spacing offset below the paragraph measured in points used to place this border.
 * @param {byte} r - Red color component value.
 * @param {byte} g - Green color component value.
 * @param {byte} b - Blue color component value.
 * @returns {boolean}
 */
ApiParaPr.prototype.SetBottomBorder = function(sType, nSize, nSpace, r, g, b){ return true; };

/**
 * Specifies the border which will be displayed at the left side of the page around the specified paragraph.
 * @memberof ApiParaPr
 * @param {BorderType} sType - The border style.
 * @param {pt_8} nSize - The width of the current left border measured in eighths of a point.
 * @param {pt} nSpace - The spacing offset to the left of the paragraph measured in points used to place this border.
 * @param {byte} r - Red color component value.
 * @param {byte} g - Green color component value.
 * @param {byte} b - Blue color component value.
 * @returns {boolean}
 */
ApiParaPr.prototype.SetLeftBorder = function(sType, nSize, nSpace, r, g, b){ return true; };

/**
 * Specifies the border which will be displayed at the right side of the page around the specified paragraph.
 * @memberof ApiParaPr
 * @param {BorderType} sType - The border style.
 * @param {pt_8} nSize - The width of the current right border measured in eighths of a point.
 * @param {pt} nSpace - The spacing offset to the right of the paragraph measured in points used to place this border.
 * @param {byte} r - Red color component value.
 * @param {byte} g - Green color component value.
 * @param {byte} b - Blue color component value.
 * @returns {boolean}
 */
ApiParaPr.prototype.SetRightBorder = function(sType, nSize, nSpace, r, g, b){ return true; };

/**
 * Specifies the border which will be displayed above a set of paragraphs which have the same set of paragraph border settings.
 * <note>The paragraphs of the same style going one by one are considered as a single block, so the border is added to the whole block rather than to every paragraph in this block.</note>
 * @memberof ApiParaPr
 * @param {BorderType} sType - The border style.
 * @param {pt_8} nSize - The width of the current top border measured in eighths of a point.
 * @param {pt} nSpace - The spacing offset above the paragraph measured in points used to place this border.
 * @param {byte} r - Red color component value.
 * @param {byte} g - Green color component value.
 * @param {byte} b - Blue color component value.
 * @returns {boolean}
 */
ApiParaPr.prototype.SetTopBorder = function(sType, nSize, nSpace, r, g, b){ return true; };

/**
 * Specifies the border which will be displayed between each paragraph in a set of paragraphs which have the same set of paragraph border settings.
 * @memberof ApiParaPr
 * @param {BorderType} sType - The border style.
 * @param {pt_8} nSize - The width of the current border measured in eighths of a point.
 * @param {pt} nSpace - The spacing offset between the paragraphs measured in points used to place this border.
 * @param {byte} r - Red color component value.
 * @param {byte} g - Green color component value.
 * @param {byte} b - Blue color component value.
 * @returns {boolean}
 */
ApiParaPr.prototype.SetBetweenBorder = function(sType, nSize, nSpace, r, g, b){ return true; };

/**
 * Specifies whether a single line of the current paragraph will be displayed on a separate page from the remaining content at display time by moving the line onto the following page.
 * @memberof ApiParaPr
 * @param {boolean} isWidowControl - The true value means that a single line of the current paragraph will be displayed on a separate page from the remaining content at display time by moving the line onto the following page.
 * @returns {boolean}
 */
ApiParaPr.prototype.SetWidowControl = function(isWidowControl){ return true; };

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
 * Specifies that the current paragraph references a numbering definition instance in the current document.
 * @memberof ApiParaPr
 * @param {ApiNumbering} oNumPr - Specifies a numbering definition.
 * @param {number} [nLvl=0] - Specifies a numbering level reference. If the current instance of the ApiParaPr class is direct
 * formatting of a paragraph, then this parameter MUST BE specified. Otherwise, if the current instance of the ApiParaPr class
 * is the part of ApiStyle properties, this parameter will be ignored.
 * @returns {boolean}
 */
ApiParaPr.prototype.SetNumPr = function(oNumPr, nLvl){ return true; };

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
 * Converts the ApiParaPr object into the JSON object.
 * @memberof ApiParaPr
 * @param {boolean} bWriteStyles - Specifies if the used styles will be written to the JSON object or not.
 * @returns {JSON}
 */
ApiParaPr.prototype.ToJSON = function(bWriteStyles){ return new JSON(); };

/**
 * Returns a type of the ApiNumbering class.
 * @memberof ApiNumbering
 * @returns {"numbering"}
 */
ApiNumbering.prototype.GetClassType = function(){ return ""; };

/**
 * Returns the specified level of the current numbering.
 * @memberof ApiNumbering
 * @param {number} nLevel - The numbering level index. This value MUST BE from 0 to 8.
 * @returns {ApiNumberingLevel}
 */
ApiNumbering.prototype.GetLevel = function(nLevel){ return new ApiNumberingLevel(); };

/**
 * Converts the ApiNumbering object into the JSON object.
 * @memberof ApiNumbering
 * @returns {JSON}
 */
ApiNumbering.prototype.ToJSON = function(){ return new JSON(); };

/**
 * Returns a type of the ApiNumberingLevel class.
 * @memberof ApiNumberingLevel
 * @returns {"numberingLevel"}
 */
ApiNumberingLevel.prototype.GetClassType = function(){ return ""; };

/**
 * Returns the numbering definition.
 * @memberof ApiNumberingLevel
 * @returns {ApiNumbering}
 */
ApiNumberingLevel.prototype.GetNumbering = function(){ return new ApiNumbering(); };

/**
 * Returns the level index.
 * @memberof ApiNumberingLevel
 * @returns {number}
 */
ApiNumberingLevel.prototype.GetLevelIndex = function(){ return 0; };

/**
 * Specifies the text properties which will be applied to the text in the current numbering level itself, not to the text in the subsequent paragraph.
 * <note>To change the text style of the paragraph, a style must be applied to it using the {@link ApiRun#SetStyle} method.</note>
 * @memberof ApiNumberingLevel
 * @returns {ApiTextPr}
 */
ApiNumberingLevel.prototype.GetTextPr = function(){ return new ApiTextPr(); };

/**
 * Returns the paragraph properties which are applied to any numbered paragraph that references the given numbering definition and numbering level.
 * @memberof ApiNumberingLevel
 * @returns {ApiParaPr}
 */
ApiNumberingLevel.prototype.GetParaPr = function(){ return new ApiParaPr(); };

/**
 * Sets one of the existing predefined numbering templates.
 * @memberof ApiNumberingLevel
 * @param {("none" | "bullet" | "1)" | "1." | "I." | "A." | "a)" | "a." | "i." )} sType - The predefined numbering template.
 * @param {string} [sSymbol=""] - The symbol used for the list numbering. This parameter has the meaning only if the predefined numbering template is "bullet".
 * @returns {boolean}
 */
ApiNumberingLevel.prototype.SetTemplateType = function(sType, sSymbol){ return true; };

/**
 * Sets your own customized numbering type.
 * @memberof ApiNumberingLevel
 * @param {("none" | "bullet" | "decimal" | "lowerRoman" | "upperRoman" | "lowerLetter" | "upperLetter" |
 *     "decimalZero")} sType - The custom numbering type used for the current numbering definition.
 * @param {string} sTextFormatString - Any text in this parameter will be taken as literal text to be repeated in each instance of this numbering level, except for any use of the percent symbol (%) followed by a number, which will be used to indicate the one-based index of the number to be used at this level. Any number of a level higher than this level will be ignored.
 * @param {("left" | "right" | "center")} sAlign - Type of justification applied to the text run in the current numbering level.
 * @returns {boolean}
 */
ApiNumberingLevel.prototype.SetCustomType = function(sType, sTextFormatString, sAlign){ return true; };

/**
 * Specifies a one-based index which determines when a numbering level should restart to its starting value. A numbering level restarts when an instance of the specified numbering level which is higher (earlier than this level) is used in the given document contents. By default this value is true.
 * @memberof ApiNumberingLevel
 * @param {boolean} isRestart - The true value means that a numbering level will be restarted to its starting value.
 * @returns {boolean}
 */
ApiNumberingLevel.prototype.SetRestart = function(isRestart){ return true; };

/**
 * Specifies the starting value for the numbering used by the parent numbering level within a given numbering level definition. By default this value is 1.
 * @memberof ApiNumberingLevel
 * @param {number} nStart - The starting value for the numbering used by the parent numbering level.
 * @returns {boolean}
 */
ApiNumberingLevel.prototype.SetStart = function(nStart){ return true; };

/**
 * Specifies the content which will be added between the given numbering level text and the text of every numbered paragraph which references that numbering level. By default this value is "tab".
 * @memberof ApiNumberingLevel
 * @param {("space" | "tab" | "none")} sType - The content added between the numbering level text and the text in the numbered paragraph.
 * @returns {boolean}
 */
ApiNumberingLevel.prototype.SetSuff = function(sType){ return true; };

/**
 * Links the specified paragraph style with the current numbering level.
 * @memberof ApiNumberingLevel
 * @param {ApiStyle} oStyle - The paragraph style.
 * @returns {boolean}
 * @since 8.3.0
 */
ApiNumberingLevel.prototype.LinkWithStyle = function(oStyle){ return true; };

/**
 * Returns a type of the ApiTablePr class.
 * @memberof ApiTablePr
 * @returns {"tablePr"}
 */
ApiTablePr.prototype.GetClassType = function(){ return ""; };

/**
 * Specifies a number of columns which will comprise each table column band for this table style.
 * @memberof ApiTablePr
 * @param {number} nCount - The number of columns measured in positive integers.
 * @returns {boolean}
 */
ApiTablePr.prototype.SetStyleColBandSize = function(nCount){ return true; };

/**
 * Specifies a number of rows which will comprise each table row band for this table style.
 * @memberof ApiTablePr
 * @param {number} nCount - The number of rows measured in positive integers.
 * @returns {boolean}
 */
ApiTablePr.prototype.SetStyleRowBandSize = function(nCount){ return true; };

/**
 * Specifies the alignment of the current table with respect to the text margins in the current section.
 * @memberof ApiTablePr
 * @param {("left" | "right" | "center")} sJcType - The alignment type used for the current table placement.
 * @returns {boolean}
 */
ApiTablePr.prototype.SetJc = function(sJcType){ return true; };

/**
 * Specifies the shading which is applied to the extents of the current table.
 * @memberof ApiTablePr
 * @param {ShdType} sType - The shading type applied to the extents of the current table.
 * @param {byte} r - Red color component value.
 * @param {byte} g - Green color component value.
 * @param {byte} b - Blue color component value.
 * @param {boolean} [isAuto=false] - The true value disables the SetShd method use.
 * @returns {boolean}
 */
ApiTablePr.prototype.SetShd = function(sType, r, g, b, isAuto){ return true; };

/**
 * Sets the border which will be displayed at the top of the current table.
 * @memberof ApiTablePr
 * @param {BorderType} sType - The top border style.
 * @param {pt_8} nSize - The width of the current top border measured in eighths of a point.
 * @param {pt} nSpace - The spacing offset in the top part of the table measured in points used to place this border.
 * @param {byte} r - Red color component value.
 * @param {byte} g - Green color component value.
 * @param {byte} b - Blue color component value.
 * @returns {boolean}
 */
ApiTablePr.prototype.SetTableBorderTop = function(sType, nSize, nSpace, r, g, b){ return true; };

/**
 * Sets the border which will be displayed at the bottom of the current table.
 * @memberof ApiTablePr
 * @param {BorderType} sType - The bottom border style.
 * @param {pt_8} nSize - The width of the current bottom border measured in eighths of a point.
 * @param {pt} nSpace - The spacing offset in the bottom part of the table measured in points used to place this border.
 * @param {byte} r - Red color component value.
 * @param {byte} g - Green color component value.
 * @param {byte} b - Blue color component value.
 * @returns {boolean}
 */
ApiTablePr.prototype.SetTableBorderBottom = function(sType, nSize, nSpace, r, g, b){ return true; };

/**
 * Sets the border which will be displayed on the left of the current table.
 * @memberof ApiTablePr
 * @param {BorderType} sType - The left border style.
 * @param {pt_8} nSize - The width of the current left border measured in eighths of a point.
 * @param {pt} nSpace - The spacing offset in the left part of the table measured in points used to place this border.
 * @param {byte} r - Red color component value.
 * @param {byte} g - Green color component value.
 * @param {byte} b - Blue color component value.
 * @returns {boolean}
 */
ApiTablePr.prototype.SetTableBorderLeft = function(sType, nSize, nSpace, r, g, b){ return true; };

/**
 * Sets the border which will be displayed on the right of the current table.
 * @memberof ApiTablePr
 * @param {BorderType} sType - The right border style.
 * @param {pt_8} nSize - The width of the current right border measured in eighths of a point.
 * @param {pt} nSpace - The spacing offset in the right part of the table measured in points used to place this border.
 * @param {byte} r - Red color component value.
 * @param {byte} g - Green color component value.
 * @param {byte} b - Blue color component value.
 * @returns {boolean}
 */
ApiTablePr.prototype.SetTableBorderRight = function(sType, nSize, nSpace, r, g, b){ return true; };

/**
 * Specifies the border which will be displayed on all horizontal table cell borders which are not on the outmost edge
 * of the parent table (all horizontal borders which are not the topmost or bottommost borders).
 * @memberof ApiTablePr
 * @param {BorderType} sType - The horizontal table cell border style.
 * @param {pt_8} nSize - The width of the current border measured in eighths of a point.
 * @param {pt} nSpace - The spacing offset in the horizontal table cells of the table measured in points used to place this border.
 * @param {byte} r - Red color component value.
 * @param {byte} g - Green color component value.
 * @param {byte} b - Blue color component value.
 * @returns {boolean}
 */
ApiTablePr.prototype.SetTableBorderInsideH = function(sType, nSize, nSpace, r, g, b){ return true; };

/**
 * Specifies the border which will be displayed on all vertical table cell borders which are not on the outmost edge
 * of the parent table (all vertical borders which are not the leftmost or rightmost borders).
 * @memberof ApiTablePr
 * @param {BorderType} sType - The vertical table cell border style.
 * @param {pt_8} nSize - The width of the current border measured in eighths of a point.
 * @param {pt} nSpace - The spacing offset in the vertical table cells of the table measured in points used to place this border.
 * @param {byte} r - Red color component value.
 * @param {byte} g - Green color component value.
 * @param {byte} b - Blue color component value.
 * @returns {boolean}
 */
ApiTablePr.prototype.SetTableBorderInsideV = function(sType, nSize, nSpace, r, g, b){ return true; };

/**
 * Specifies a border which will be displayed on all table cell borders.
 * @memberof ApiTablePr
 * @param {BorderType} sType - The border style.
 * @param {pt_8} nSize - The width of the current border measured in eighths of a point.
 * @param {pt} nSpace - The spacing offset in the table cells measured in points used to place this border.
 * @param {byte} r - Red color component value.
 * @param {byte} g - Green color component value.
 * @param {byte} b - Blue color component value.
 * @returns {boolean}
 * @since 9.0.0
 */
ApiTablePr.prototype.SetTableBorderAll = function(sType, nSize, nSpace, r, g, b){ return true; };

/**
 * Specifies an amount of space which will be left between the bottom extent of the cell contents and the border
 * of all table cells within the parent table (or table row).
 * @memberof ApiTablePr
 * @param {twips} nValue - The value for the amount of space below the bottom extent of the cell measured in
 * twentieths of a point (1/1440 of an inch).
 * @returns {boolean}
 */
ApiTablePr.prototype.SetTableCellMarginBottom = function(nValue){ return true; };

/**
 * Specifies an amount of space which will be left between the left extent of the cell contents and the left
 * border of all table cells within the parent table (or table row).
 * @memberof ApiTablePr
 * @param {twips} nValue - The value for the amount of space to the left extent of the cell measured in twentieths of a point (1/1440 of an inch).
 * @returns {boolean}
 */
ApiTablePr.prototype.SetTableCellMarginLeft = function(nValue){ return true; };

/**
 * Specifies an amount of space which will be left between the right extent of the cell contents and the right
 * border of all table cells within the parent table (or table row).
 * @memberof ApiTablePr
 * @param {twips} nValue - The value for the amount of space to the right extent of the cell measured in twentieths of a point (1/1440 of an inch).
 * @returns {boolean}
 */
ApiTablePr.prototype.SetTableCellMarginRight = function(nValue){ return true; };

/**
 * Specifies an amount of space which will be left between the top extent of the cell contents and the top border
 * of all table cells within the parent table (or table row).
 * @memberof ApiTablePr
 * @param {twips} nValue - The value for the amount of space above the top extent of the cell measured in twentieths of a point (1/1440 of an inch).
 * @returns {boolean}
 */
ApiTablePr.prototype.SetTableCellMarginTop = function(nValue){ return true; };

/**
 * Specifies the default table cell spacing (the spacing between adjacent cells and the edges of the table).
 * @memberof ApiTablePr
 * @param {?twips} nValue - Spacing value measured in twentieths of a point (1/1440 of an inch). <code>"Null"</code> means that no spacing will be applied.
 * @returns {boolean}
 */
ApiTablePr.prototype.SetCellSpacing = function(nValue){ return true; };

/**
 * Specifies the indentation which will be added before the leading edge of the current table in the document
 * (the left edge in the left-to-right table, and the right edge in the right-to-left table).
 * @memberof ApiTablePr
 * @param {twips} nValue - The indentation value measured in twentieths of a point (1/1440 of an inch).
 * @returns {boolean}
 */
ApiTablePr.prototype.SetTableInd = function(nValue){ return true; };

/**
 * Sets the preferred width to the current table.
 * <note>Tables are created with the {@link ApiTable#SetWidth} method properties set by default, which always override the {@link ApiTablePr#SetWidth} method properties. That is why there is no use to try and apply {@link ApiTablePr#SetWidth}. We recommend you to use the  {@link ApiTablePr#SetWidth} method instead.</note>
 * @memberof ApiTablePr
 * @param {TableWidth} sType - Type of the width value from one of the available width values types.
 * @param {number} [nValue] - The table width value measured in positive integers.
 * @returns {boolean}
 */
ApiTablePr.prototype.SetWidth = function(sType, nValue){ return true; };

/**
 * Specifies the algorithm which will be used to lay out the contents of the current table within the document.
 * @memberof ApiTablePr
 * @param {("autofit" | "fixed")} sType - The type of the table layout in the document.
 * @returns {boolean}
 */
ApiTablePr.prototype.SetTableLayout = function(sType){ return true; };

/**
 * Sets the table title (caption).
 * @memberof ApiTablePr
 * @param {string} sTitle - The table title to be set.
 * @returns {boolean}
 */
ApiTablePr.prototype.SetTableTitle = function(sTitle){ return true; };

/**
 * Returns the table title (caption).
 * @memberof ApiTablePr
 * @returns {string}
 */
ApiTablePr.prototype.GetTableTitle = function(){ return ""; };

/**
 * Sets the table description.
 * @memberof ApiTablePr
 * @param {string} sDescr - The table description to be set.
 * @returns {boolean}
 */
ApiTablePr.prototype.SetTableDescription = function(sDescr){ return true; };

/**
 * Returns the table description.
 * @memberof ApiTablePr
 * @returns {string}
 */
ApiTablePr.prototype.GetTableDescription = function(){ return ""; };

/**
 * Converts the ApiTablePr object into the JSON object.
 * @memberof ApiTablePr
 * @returns {JSON}
 */
ApiTablePr.prototype.ToJSON = function(){ return new JSON(); };

/**
 * Returns a type of the ApiTableRowPr class.
 * @memberof ApiTableRowPr
 * @returns {"tableRowPr"}
 */
ApiTableRowPr.prototype.GetClassType = function(){ return ""; };

/**
 * Sets the height to the current table row within the current table.
 * @memberof ApiTableRowPr
 * @param {("auto" | "atLeast")} sHRule - The rule to apply the height value to the current table row or ignore it. Use the <code>"atLeast"</code> value to enable the <code>SetHeight</code> method use.
 * @param {twips} [nValue] - The height for the current table row measured in twentieths of a point (1/1440 of an inch). This value will be ignored if <code>sHRule="auto"<code>.
 * @returns {boolean}
 */
ApiTableRowPr.prototype.SetHeight = function(sHRule, nValue){ return true; };

/**
 * Specifies that the current table row will be repeated at the top of each new page 
 * wherever this table is displayed. This gives this table row the behavior of a 'header' row on 
 * each of these pages. This element can be applied to any number of rows at the top of the 
 * table structure in order to generate multi-row table headers.
 * @memberof ApiTableRowPr
 * @param {boolean} isHeader - The true value means that the current table row will be repeated at the top of each new page.
 * @returns {boolean}
 */
ApiTableRowPr.prototype.SetTableHeader = function(isHeader){ return true; };

/**
 * Converts the ApiTableRowPr object into the JSON object.
 * @memberof ApiTableRowPr
 * @returns {JSON}
 */
ApiTableRowPr.prototype.ToJSON = function(){ return new JSON(); };

/**
 * Returns a type of the ApiTableCellPr class.
 * @memberof ApiTableCellPr
 * @returns {"tableCellPr"}
 */
ApiTableCellPr.prototype.GetClassType = function(){ return ""; };

/**
 * Specifies the shading applied to the contents of the table cell.
 * @memberof ApiTableCellPr
 * @param {ShdType} sType - The shading type which will be applied to the contents of the current table cell.
 * @param {byte} r - Red color component value.
 * @param {byte} g - Green color component value.
 * @param {byte} b - Blue color component value.
 * @param {boolean} [isAuto=false] - The true value disables the table cell contents shading.
 * @returns {boolean}
 */
ApiTableCellPr.prototype.SetShd = function(sType, r, g, b, isAuto){ return true; };

/**
 * Specifies an amount of space which will be left between the bottom extent of the cell contents and the border
 * of a specific table cell within a table.
 * @memberof ApiTableCellPr
 * @param {?twips} nValue - The value for the amount of space below the bottom extent of the cell measured in twentieths
 * of a point (1/1440 of an inch). If this value is <code>null</code>, then default table cell bottom margin will be used, otherwise
 * the table cell bottom margin will be overridden with the specified value for the current cell.
 * @returns {boolean}
 */
ApiTableCellPr.prototype.SetCellMarginBottom = function(nValue){ return true; };

/**
 * Specifies an amount of space which will be left between the left extent of the cell contents and 
 * the border of a specific table cell within a table.
 * @memberof ApiTableCellPr
 * @param {?twips} nValue - The value for the amount of space to the left extent of the cell measured in twentieths
 * of a point (1/1440 of an inch). If this value is <code>null</code>, then default table cell left margin will be used, otherwise
 * the table cell left margin will be overridden with the specified value for the current cell.
 * @returns {boolean}
 */
ApiTableCellPr.prototype.SetCellMarginLeft = function(nValue){ return true; };

/**
 * Specifies an amount of space which will be left between the right extent of the cell contents and the border of a specific table cell within a table.
 * @memberof ApiTableCellPr
 * @param {?twips} nValue - The value for the amount of space to the right extent of the cell measured in twentieths
 * of a point (1/1440 of an inch). If this value is <code>null</code>, then default table cell right margin will be used, otherwise
 * the table cell right margin will be overridden with the specified value for the current cell.
 * @returns {boolean}
 */
ApiTableCellPr.prototype.SetCellMarginRight = function(nValue){ return true; };

/**
 * Specifies an amount of space which will be left between the upper extent of the cell contents
 * and the border of a specific table cell within a table.
 * @memberof ApiTableCellPr
 * @param {?twips} nValue - The value for the amount of space above the upper extent of the cell measured in twentieths
 * of a point (1/1440 of an inch). If this value is <code>null</code>, then default table cell top margin will be used, otherwise
 * the table cell top margin will be overridden with the specified value for the current cell.
 * @returns {boolean}
 */
ApiTableCellPr.prototype.SetCellMarginTop = function(nValue){ return true; };

/**
 * Sets the border which will be displayed at the bottom of the current table cell.
 * @memberof ApiTableCellPr
 * @param {BorderType} sType - The cell bottom border style.
 * @param {pt_8} nSize - The width of the current cell bottom border measured in eighths of a point.
 * @param {pt} nSpace - The spacing offset in the bottom part of the table cell measured in points used to place this border.
 * @param {byte} r - Red color component value.
 * @param {byte} g - Green color component value.
 * @param {byte} b - Blue color component value.
 * @returns {boolean}
 */
ApiTableCellPr.prototype.SetCellBorderBottom = function(sType, nSize, nSpace, r, g, b){ return true; };

/**
 * Sets the border which will be displayed to the left of the current table cell.
 * @memberof ApiTableCellPr
 * @param {BorderType} sType - The cell left border style.
 * @param {pt_8} nSize - The width of the current cell left border measured in eighths of a point.
 * @param {pt} nSpace - The spacing offset in the left part of the table cell measured in points used to place this border.
 * @param {byte} r - Red color component value.
 * @param {byte} g - Green color component value.
 * @param {byte} b - Blue color component value.
 * @returns {boolean}
 */
ApiTableCellPr.prototype.SetCellBorderLeft = function(sType, nSize, nSpace, r, g, b){ return true; };

/**
 * Sets the border which will be displayed to the right of the current table cell.
 * @memberof ApiTableCellPr
 * @param {BorderType} sType - The cell right border style.
 * @param {pt_8} nSize - The width of the current cell right border measured in eighths of a point.
 * @param {pt} nSpace - The spacing offset in the right part of the table cell measured in points used to place this border.
 * @param {byte} r - Red color component value.
 * @param {byte} g - Green color component value.
 * @param {byte} b - Blue color component value.
 * @returns {boolean}
 */
ApiTableCellPr.prototype.SetCellBorderRight = function(sType, nSize, nSpace, r, g, b){ return true; };

/**
 * Sets the border which will be displayed at the top of the current table cell.
 * @memberof ApiTableCellPr
 * @param {BorderType} sType - The cell top border style.
 * @param {pt_8} nSize - The width of the current cell top border measured in eighths of a point.
 * @param {pt} nSpace - The spacing offset in the top part of the table cell measured in points used to place this border.
 * @param {byte} r - Red color component value.
 * @param {byte} g - Green color component value.
 * @param {byte} b - Blue color component value.
 * @returns {boolean}
 */
ApiTableCellPr.prototype.SetCellBorderTop = function(sType, nSize, nSpace, r, g, b){ return true; };

/**
 * Sets the preferred width to the current table cell.
 * @memberof ApiTableCellPr
 * @param {TableWidth} sType - Type of the width value from one of the available width values types.
 * @param {number} [nValue] - The table cell width value measured in positive integers.
 * @returns {boolean}
 */
ApiTableCellPr.prototype.SetWidth = function(sType, nValue){ return true; };

/**
 * Specifies the vertical alignment for the text contents within the current table cell.
 * @memberof ApiTableCellPr
 * @param {("top" | "center" | "bottom")} sType - The available types of the vertical alignment for the text contents of the current table cell.
 * @returns {boolean}
 */
ApiTableCellPr.prototype.SetVerticalAlign = function(sType){ return true; };

/**
 * Specifies the direction of the text flow for this table cell.
 * @memberof ApiTableCellPr
 * @param {("lrtb" | "tbrl" | "btlr")} sType - The available types of the text direction in the table cell: <code>"lrtb"</code>
 * - text direction left-to-right moving from top to bottom, <code>"tbrl"</code> - text direction top-to-bottom moving from right
 * to left, <code>"btlr"</code> - text direction bottom-to-top moving from left to right.
 * @returns {boolean}
 */
ApiTableCellPr.prototype.SetTextDirection = function(sType){ return true; };

/**
 * Specifies how the current table cell is laid out when the parent table is displayed in a document. This setting
 * only affects the behavior of the cell when the {@link ApiTablePr#SetTableLayout} table layout for this table is set to use the <code>"autofit"</code> algorithm.
 * @memberof ApiTableCellPr
 * @param {boolean} isNoWrap - The true value means that the current table cell will not be wrapped in the parent table.
 * @returns {boolean}
 */
ApiTableCellPr.prototype.SetNoWrap = function(isNoWrap){ return true; };

/**
 * Converts the ApiTableCellPr object into the JSON object.
 * @memberof ApiTableCellPr
 * @returns {JSON}
 */
ApiTableCellPr.prototype.ToJSON = function(){ return new JSON(); };

/**
 * Returns a type of the ApiTableStylePr class.
 * @memberof ApiTableStylePr
 * @returns {"tableStylePr"}
 */
ApiTableStylePr.prototype.GetClassType = function(){ return ""; };

/**
 * Returns a type of the current table conditional style.
 * @memberof ApiTableStylePr
 * @returns {TableStyleOverrideType}
 */
ApiTableStylePr.prototype.GetType = function(){ return new TableStyleOverrideType(); };

/**
 * Returns a set of the text run properties which will be applied to all the text runs within the table which match the conditional formatting type.
 * @memberof ApiTableStylePr
 * @returns {ApiTextPr}
 */
ApiTableStylePr.prototype.GetTextPr = function(){ return new ApiTextPr(); };

/**
 * Sets the text properties to the current table style properties.
 * @memberof ApiTableStylePr
 * @param {ApiTextPr} oTextPr - The properties that will be set.
 * @returns {ApiTableStylePr} - this
 */
ApiTableStylePr.prototype.SetTextPr = function(oTextPr){ return new ApiTableStylePr(); };

/**
 * Returns a set of the paragraph properties which will be applied to all the paragraphs within a table which match the conditional formatting type.
 * @memberof ApiTableStylePr
 * @returns {ApiParaPr}
 */
ApiTableStylePr.prototype.GetParaPr = function(){ return new ApiParaPr(); };

/**
 * Sets the paragraph properties to the current table style properties.
 * @memberof ApiTableStylePr
 * @param {ApiParaPr} oParaPr - The properties that will be set.
 * @returns {ApiTableStylePr} - this
 */
ApiTableStylePr.prototype.SetParaPr = function(oParaPr){ return new ApiTableStylePr(); };

/**
 * Returns a set of the table properties which will be applied to all the regions within a table which match the conditional formatting type.
 * @memberof ApiTableStylePr
 * @returns {ApiTablePr}
 */
ApiTableStylePr.prototype.GetTablePr = function(){ return new ApiTablePr(); };

/**
 * Sets the table properties to the current table style properties.
 * @memberof ApiTableStylePr
 * @param {ApiTablePr} oTablePr - The properties that will be set.
 * @returns {ApiTableStylePr} - this
 */
ApiTableStylePr.prototype.SetTablePr = function(oTablePr){ return new ApiTableStylePr(); };

/**
 * Returns a set of the table row properties which will be applied to all the rows within a table which match the conditional formatting type.
 * @memberof ApiTableStylePr
 * @returns {ApiTableRowPr}
 */
ApiTableStylePr.prototype.GetTableRowPr = function(){ return new ApiTableRowPr(); };

/**
 * Sets the table row properties to the current table style properties.
 * @memberof ApiTableStylePr
 * @param {ApiTableRowPr} oTableRowPr - The properties that will be set.
 * @returns {ApiTableStylePr} - this
 */
ApiTableStylePr.prototype.SetTableRowPr = function(oTableRowPr){ return new ApiTableStylePr(); };

/**
 * Returns a set of the table cell properties which will be applied to all the cells within a table which match the conditional formatting type.
 * @memberof ApiTableStylePr
 * @returns {ApiTableCellPr}
 */
ApiTableStylePr.prototype.GetTableCellPr = function(){ return new ApiTableCellPr(); };

/**
 * Sets the table cell properties to the current table style properties.
 * @memberof ApiTableStylePr
 * @param {ApiTableCellPr} oTableCellPr - The properties that will be set.
 * @returns {ApiTableStylePr} - this
 */
ApiTableStylePr.prototype.SetTableCellPr = function(oTableCellPr){ return new ApiTableStylePr(); };

/**
 * Converts the ApiTableStylePr object into the JSON object.
 * @memberof ApiTableStylePr
 * @returns {JSON}
 */
ApiTableStylePr.prototype.ToJSON = function(){ return new JSON(); };

/**
 * Returns a type of the ApiDrawing class.
 * @memberof ApiDrawing
 * @returns {"drawing"}
 */
ApiDrawing.prototype.GetClassType = function(){ return ""; };

/**
 * Returns the drawing inner contents where a paragraph or text runs can be inserted if it exists.
 * @memberof ApiDrawing
 * @returns {ApiDocumentContent}
 */
ApiDrawing.prototype.GetContent = function(){ return new ApiDocumentContent(); };

/**
 * Sets the size of the object (image, shape, chart) bounding box.
 * @memberof ApiDrawing
 * @param {EMU} nWidth - The object width measured in English measure units.
 * @param {EMU} nHeight - The object height measured in English measure units.
 * @returns {boolean}
 */
ApiDrawing.prototype.SetSize = function(nWidth, nHeight){ return true; };

/**
 * Sets the wrapping type of the current object (image, shape, chart). One of the following wrapping style types can be set:
 * <b>"inline"</b> - the object is considered to be a part of the text, like a character, so when the text moves, the object moves as well. In this case the positioning options are inaccessible.
 * If one of the following styles is selected, the object can be moved independently of the text and positioned on the page exactly:
 * <b>"square"</b> - the text wraps the rectangular box that bounds the object.
 * <b>"tight"</b> - the text wraps the actual object edges.
 * <b>"through"</b> - the text wraps around the object edges and fills in the open white space within the object.
 * <b>"topAndBottom"</b> - the text is only above and below the object.
 * <b>"behind"</b> - the text overlaps the object.
 * <b>"inFront"</b> - the object overlaps the text.
 * @memberof ApiDrawing
 * @param {"inline" | "square" | "tight" | "through" | "topAndBottom" | "behind" | "inFront"} sType - The wrapping style type available for the object.
 * @returns {boolean}
 */
ApiDrawing.prototype.SetWrappingStyle = function(sType){ return true; };

/**
 * Specifies how the floating object will be horizontally aligned.
 * @memberof ApiDrawing
 * @param {RelFromH} [sRelativeFrom="page"] - The document element which will be taken as a countdown point for the object horizontal alignment.
 * @param {("left" | "right" | "center")} [sAlign="left"] - The alignment type which will be used for the object horizontal alignment.
 * @returns {boolean}
 */
ApiDrawing.prototype.SetHorAlign = function(sRelativeFrom, sAlign){ return true; };

/**
 * Specifies how the floating object will be vertically aligned.
 * @memberof ApiDrawing
 * @param {RelFromV} [sRelativeFrom="page"] - The document element which will be taken as a countdown point for the object vertical alignment.
 * @param {("top" | "bottom" | "center")} [sAlign="top"] - The alingment type which will be used for the object vertical alignment.
 * @returns {boolean}
 */
ApiDrawing.prototype.SetVerAlign = function(sRelativeFrom, sAlign){ return true; };

/**
 * Sets the absolute measurement for the horizontal positioning of the floating object.
 * @memberof ApiDrawing
 * @param {RelFromH} sRelativeFrom - The document element which will be taken as a countdown point for the object horizontal alignment.
 * @param {EMU} nDistance - The distance from the right side of the document element to the floating object measured in English measure units.
 * @returns {boolean}
 */
ApiDrawing.prototype.SetHorPosition = function(sRelativeFrom, nDistance){ return true; };

/**
 * Sets the absolute measurement for the vertical positioning of the floating object.
 * @memberof ApiDrawing
 * @param {RelFromV} sRelativeFrom - The document element which will be taken as a countdown point for the object vertical alignment.
 * @param {EMU} nDistance - The distance from the bottom part of the document element to the floating object measured in English measure units.
 * @returns {boolean}
 */
ApiDrawing.prototype.SetVerPosition = function(sRelativeFrom, nDistance){ return true; };

/**
 * Specifies the minimum distance which will be maintained between the edges of the current drawing object and any
 * subsequent text.
 * @memberof ApiDrawing
 * @param {EMU} nLeft - The distance from the left side of the current object and the subsequent text run measured in English measure units.
 * @param {EMU} nTop - The distance from the top side of the current object and the preceding text run measured in English measure units.
 * @param {EMU} nRight - The distance from the right side of the current object and the subsequent text run measured in English measure units.
 * @param {EMU} nBottom - The distance from the bottom side of the current object and the subsequent text run measured in English measure units.
 * @returns {boolean}
 */
ApiDrawing.prototype.SetDistances = function(nLeft, nTop, nRight, nBottom){ return true; };

/**
 * Returns a parent paragraph that contains the graphic object.
 * @memberof ApiDrawing
 * @returns {ApiParagraph | null} - returns null if parent paragraph doesn't exist.
 */
ApiDrawing.prototype.GetParentParagraph = function(){ return new ApiParagraph(); };

/**
 * Returns a parent content control that contains the graphic object.
 * @memberof ApiDrawing
 * @returns {ApiBlockLvlSdt | null} - returns null if parent content control doesn't exist.
 */
ApiDrawing.prototype.GetParentContentControl = function(){ return new ApiBlockLvlSdt(); };

/**
 * Returns a parent table that contains the graphic object.
 * @memberof ApiDrawing
 * @returns {ApiTable | null} - returns null if parent table doesn't exist.
 */
ApiDrawing.prototype.GetParentTable = function(){ return new ApiTable(); };

/**
 * Returns a parent table cell that contains the graphic object.
 * @returns {ApiTableCell | null} - returns null if parent cell doesn't exist.
 */
ApiDrawing.prototype.GetParentTableCell = function(){ return new ApiTableCell(); };

/**
 * Deletes the current graphic object. 
 * @returns {boolean} - returns false if drawing object haven't parent.
 */
ApiDrawing.prototype.Delete = function(){ return true; };

/**
 * Copies the current graphic object. 
 * @memberof ApiDrawing
 * @returns {ApiDrawing}
 */
ApiDrawing.prototype.Copy = function(){ return new ApiDrawing(); };

/**
 * Wraps the graphic object with a rich text content control.
 * @memberof ApiDrawing
 * @param {number} nType - Defines if this method returns the ApiBlockLvlSdt (nType === 1) or ApiDrawing (any value except 1) object.
 * @returns {ApiDrawing | ApiBlockLvlSdt}  
 */
ApiDrawing.prototype.InsertInContentControl = function(nType){ return new ApiDrawing(); };

/**
 * Inserts a paragraph at the specified position.
 * @memberof ApiDrawing
 * @param {string | ApiParagraph} paragraph - Text or paragraph.
 * @param {string} sPosition - The position where the text or paragraph will be inserted ("before" or "after" the drawing specified).
 * @param {boolean} beRNewPara - Defines if this method returns a new paragraph (true) or the current ApiDrawing (false).
 * @returns {ApiParagraph | ApiDrawing} - returns null if parent paragraph doesn't exist.
 */
ApiDrawing.prototype.InsertParagraph = function(paragraph, sPosition, beRNewPara){ return new ApiParagraph(); };

/**
 * Selects the current graphic object.
 * @memberof ApiDrawing
 * @returns {boolean}
 */
ApiDrawing.prototype.Select = function(){ return true; };

/**
 * Inserts a break at the specified location in the main document.
 * @memberof ApiDrawing
 * @param {number}breakType - The break type: page break (0) or line break (1).
 * @param {string}position  - The position where the page or line break will be inserted ("before" or "after" the current drawing).
 * @returns {boolean}  - returns false if drawing object haven't parent run or params are invalid.
 */
ApiDrawing.prototype.AddBreak = function(breakType, position){ return true; };

/**
 * Flips the current drawing horizontally.
 * @memberof ApiDrawing
 * @param {boolean} bFlip - Specifies if the figure will be flipped horizontally or not.
 * @returns {boolean}
 */
ApiDrawing.prototype.SetHorFlip = function(bFlip){ return true; };

/**
 * Flips the current drawing vertically.
 * @memberof ApiDrawing
 * @param {boolean} bFlip - Specifies if the figure will be flipped vertically or not.
 * @returns {boolean} - returns false if param is invalid.
 */
ApiDrawing.prototype.SetVertFlip = function(bFlip){ return true; };

/**
 * Scales the height of the figure using the specified coefficient.
 * @memberof ApiDrawing
 * @param {number} coefficient - The coefficient by which the figure height will be scaled.
 * @returns {boolean} - return false if param is invalid.
 */
ApiDrawing.prototype.ScaleHeight = function(coefficient){ return true; };

/**
 * Scales the width of the figure using the specified coefficient.
 * @memberof ApiDrawing
 * @param {number} coefficient - The coefficient by which the figure width will be scaled.
 * @returns {boolean} - return false if param is invali.
 */
ApiDrawing.prototype.ScaleWidth = function(coefficient){ return true; };

/**
 * Sets the fill formatting properties to the current graphic object.
 * @memberof ApiDrawing
 * @param {ApiFill} oFill - The fill type used to fill the graphic object.
 * @returns {boolean} - returns false if param is invalid.
 */
ApiDrawing.prototype.Fill = function(oFill){ return true; };

/**
 * Sets the outline properties to the specified graphic object.
 * @memberof ApiDrawing
 * @param {ApiStroke} oStroke - The stroke used to create the graphic object outline.
 * @returns {boolean} - returns false if param is invalid.
 */
ApiDrawing.prototype.SetOutLine = function(oStroke){ return true; };

/**
 * Returns the next inline drawing object if exists. 
 *  @memberof ApiDrawing
 * @returns {ApiDrawing | null} - returns null if drawing object is last.
 */
ApiDrawing.prototype.GetNextDrawing = function(){ return new ApiDrawing(); };

/**
 * Returns the previous inline drawing object if exists. 
 * @memberof ApiDrawing
 * @returns {ApiDrawing | null} - returns null if drawing object is first.
 */
ApiDrawing.prototype.GetPrevDrawing = function(){ return new ApiDrawing(); };

/**
 * Converts the ApiDrawing object into the JSON object.
 * @memberof ApiDrawing
 * @param {boolean} bWriteNumberings - Specifies if the used numberings will be written to the JSON object or not.
 * @param {boolean} bWriteStyles - Specifies if the used styles will be written to the JSON object or not.
 * @returns {JSON}
 */
ApiDrawing.prototype.ToJSON = function(bWriteNumberings, bWriteStyles){ return new JSON(); };

/**
 * Returns the width of the current drawing.
 * @memberof ApiDrawing
 * @returns {EMU}
 */
ApiDrawing.prototype.GetWidth = function(){ return new EMU(); };

/**
 * Returns the height of the current drawing.
 * @memberof ApiDrawing
 * @returns {EMU}
 */
ApiDrawing.prototype.GetHeight = function(){ return new EMU(); };

/**
 * Returns the lock value for the specified lock type of the current drawing.
 * @param {DrawingLockType} sType - Lock type in the string format.
 * @returns {boolean}
 */
ApiDrawing.prototype.GetLockValue = function(sType){ return true; };

/**
 * Sets the lock value to the specified lock type of the current drawing.
 * @param {DrawingLockType} sType - Lock type in the string format.
 * @param {boolean} bValue - Specifies if the specified lock is applied to the current drawing.
 * @returns {boolean}
 */
ApiDrawing.prototype.SetLockValue = function(sType, bValue){ return true; };

/**
 * Sets the properties from another drawing to the current drawing.
 * The following properties will be copied: horizontal and vertical alignment, distance between the edges of the current drawing object and any subsequent text, wrapping style, drawing name, title and description.
 * @memberof ApiDrawing
 * @param {ApiDrawing} oAnotherDrawing - The drawing which properties will be set to the current drawing.
 * @returns {boolean}
 */
ApiDrawing.prototype.SetDrawingPrFromDrawing = function(oAnotherDrawing){ return true; };

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
ApiImage.prototype.GetClassType = function(){ return ""; };

/**
 * Returns the next inline image if exists. 
 * @memberof ApiImage
 * @returns {ApiImage | null} - returns null if image is last.
 */
ApiImage.prototype.GetNextImage= function(){ return new ApiImage(); };

/**
 * Returns the previous inline image if exists. 
 * @memberof ApiImage
 * @returns {ApiImage | null} - returns null if image is first.
 */
ApiImage.prototype.GetPrevImage= function(){ return new ApiImage(); };

/**
 * Returns a type of the ApiOleObject class.
 * @memberof ApiOleObject
 * @returns {"oleObject"}
 */
ApiOleObject.prototype.GetClassType = function(){ return ""; };

/**
 * Sets the data to the current OLE object.
 * @memberof ApiOleObject
 * @param {string} sData - The OLE object string data.
 * @returns {boolean}
 */
ApiOleObject.prototype.SetData = function(sData){ return true; };

/**
 * Returns the string data from the current OLE object.
 * @memberof ApiOleObject
 * @returns {string}
 */
ApiOleObject.prototype.GetData = function(){ return ""; };

/**
 * Sets the application ID to the current OLE object.
 * @memberof ApiOleObject
 * @param {string} sAppId - The application ID associated with the curent OLE object.
 * @returns {boolean}
 */
ApiOleObject.prototype.SetApplicationId = function(sAppId){ return true; };

/**
 * Returns the application ID from the current OLE object.
 * @memberof ApiOleObject
 * @returns {string}
 */
ApiOleObject.prototype.GetApplicationId = function(){ return ""; };

/**
 * Returns a type of the ApiShape class.
 * @memberof ApiShape
 * @returns {"shape"}
 */
ApiShape.prototype.GetClassType = function(){ return ""; };

/**
 * Returns the shape inner contents where a paragraph or text runs can be inserted.
 * @memberof ApiShape
 * @returns {ApiDocumentContent}
 */
ApiShape.prototype.GetDocContent = function(){ return new ApiDocumentContent(); };

/**
 * Sets the vertical alignment to the shape content where a paragraph or text runs can be inserted.
 * @memberof ApiShape
 * @param {VerticalTextAlign} VerticalAlign - The type of the vertical alignment for the shape inner contents.
 * @returns {boolean}
 */
ApiShape.prototype.SetVerticalTextAlign = function(VerticalAlign){ return true; };

/**
 * Sets the text paddings to the current shape.
 * @memberof ApiShape
 * @param {?EMU} nLeft - Left padding.
 * @param {?EMU} nTop - Top padding.
 * @param {?EMU} nRight - Right padding.
 * @param {?EMU} nBottom - Bottom padding.
 * @returns {boolean}
 */
ApiShape.prototype.SetPaddings = function(nLeft, nTop, nRight, nBottom){ return true; };

/**
 * Returns the next inline shape if exists. 
 * @memberof ApiShape
 * @returns {ApiShape | null} - returns null if shape is last.
 */
ApiShape.prototype.GetNextShape = function(){ return new ApiShape(); };

/**
 * Returns the previous inline shape if exists. 
 * @memberof ApiShape
 * @returns {ApiShape | null} - returns null is shape is first.
 */
ApiShape.prototype.GetPrevShape= function(){ return new ApiShape(); };

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
 * Specifies font size for labels of the horizontal axis.
 * @memberof ApiChart
 * @param {pt} nFontSize - The text size value measured in points.
 * @returns {boolean}
 */
ApiChart.prototype.SetHorAxisLablesFontSize = function(nFontSize){ return true; };

/**
 * Specifies font size for labels of the vertical axis.
 * @memberof ApiChart
 * @param {pt} nFontSize - The text size value measured in points.
 * @returns {boolean}
 */
ApiChart.prototype.SetVertAxisLablesFontSize = function(nFontSize){ return true; };

/**
 * Returns the next inline chart if exists.
 * @memberof ApiChart
 * @returns {ApiChart | null} - returns null if chart is last.
 */
ApiChart.prototype.GetNextChart = function(){ return new ApiChart(); };

/**
 * Returns the previous inline chart if exists. 
 * @memberof ApiChart
 * @returns {ApiChart | null} - return null if char if first.
 */
ApiChart.prototype.GetPrevChart= function(){ return new ApiChart(); };

/**
 * Removes the specified series from the current chart.
 * @memberof ApiChart
 * @param {number} nSeria - The index of the chart series.
 * @returns {boolean}
 */
ApiChart.prototype.RemoveSeria = function(nSeria){ return true; };

/**
 * Sets values to the specified chart series.
 * @memberof ApiChart
 * @param {number[]} aValues - The array of the data which will be set to the specified chart series.
 * @param {number} nSeria - The index of the chart series.
 * @returns {boolean}
 */
ApiChart.prototype.SetSeriaValues = function(aValues, nSeria){ return true; };

/**
 * Sets the x-axis values to all chart series. It is used with the scatter charts only.
 * @memberof ApiChart
 * @param {string[]} aValues - The array of the data which will be set to the x-axis data points.
 * @returns {boolean}
 */
ApiChart.prototype.SetXValues = function(aValues){ return true; };

/**
 * Sets a name to the specified chart series.
 * @memberof ApiChart
 * @param {string} sName - The name which will be set to the specified chart series.
 * @param {number} nSeria - The index of the chart series.
 * @returns {boolean}
 */
ApiChart.prototype.SetSeriaName = function(sName, nSeria){ return true; };

/**
 * Sets a name to the specified chart category.
 * @memberof ApiChart
 * @param {string} sName - The name which will be set to the specified chart category.
 * @param {number} nCategory - The index of the chart category.
 * @returns {boolean}
 */
ApiChart.prototype.SetCategoryName = function(sName, nCategory){ return true; };

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
 * Sets the specified numeric format to the chart series.
 * @memberof ApiChart
 * @param {NumFormat | String} sFormat - Numeric format (can be custom format).
 * @param {Number} nSeria - Series index.
 * @returns {boolean}
 */
ApiChart.prototype.SetSeriaNumFormat = function(sFormat, nSeria){ return true; };

/**
 * Sets the specified numeric format to the chart data point.
 * @memberof ApiChart
 * @param {NumFormat | String} sFormat - Numeric format (can be custom format).
 * @param {Number} nSeria - Series index.
 * @param {number} nDataPoint - The index of the data point in the specified chart series.
 * @param {boolean} bAllSeries - Specifies if the numeric format will be applied to the specified data point in all series.
 * @returns {boolean}
 */
ApiChart.prototype.SetDataPointNumFormat = function(sFormat, nSeria, nDataPoint, bAllSeries){ return true; };

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
 * Returns a type of the ApiGroup class.
 * @memberof ApiGroup
 * @returns {"group"}
 * @since 8.3.0
 */
ApiGroup.prototype.GetClassType = function(){ return ""; };

/**
 * Ungroups the current group of drawings.
 * @memberof ApiGroup
 * @returns {boolean}
 * @since 8.3.0
 */
ApiGroup.prototype.Ungroup = function(){ return true; };

/**
 * Returns a type of the ApiFill class.
 * @memberof ApiFill
 * @returns {"fill"}
 */
ApiFill.prototype.GetClassType = function(){ return ""; };

/**
 * Converts the ApiFill object into the JSON object.
 * @memberof ApiFill
 * @returns {JSON}
 */
ApiFill.prototype.ToJSON = function(){ return new JSON(); };

/**
 * Returns a type of the ApiStroke class.
 * @memberof ApiStroke
 * @returns {"stroke"}
 */
ApiStroke.prototype.GetClassType = function(){ return ""; };

/**
 * Converts the ApiStroke object into the JSON object.
 * @memberof ApiStroke
 * @returns {JSON}
 */
ApiStroke.prototype.ToJSON = function(){ return new JSON(); };

/**
 * Returns a type of the ApiGradientStop class.
 * @memberof ApiGradientStop
 * @returns {"gradientStop"}
 */
ApiGradientStop.prototype.GetClassType = function (){ return ""; };

/**
 * Converts the ApiGradientStop object into the JSON object.
 * @memberof ApiGradientStop
 * @returns {JSON}
 */
ApiGradientStop.prototype.ToJSON = function(){ return new JSON(); };

/**
 * Returns a type of the ApiUniColor class.
 * @memberof ApiUniColor
 * @returns {"uniColor"}
 */
ApiUniColor.prototype.GetClassType = function (){ return ""; };

/**
 * Converts the ApiUniColor object into the JSON object.
 * @memberof ApiUniColor
 * @returns {JSON}
 */
ApiUniColor.prototype.ToJSON = function(){ return new JSON(); };

/**
 * Returns a color value in RGB format.
 * @memberof ApiUniColor
 * @returns {number}
 */
ApiUniColor.prototype.GetRGB = function(){ return 0; };

/**
 * Returns a type of the ApiRGBColor class.
 * @memberof ApiRGBColor
 * @returns {"rgbColor"}
 */
ApiRGBColor.prototype.GetClassType = function (){ return ""; };

/**
 * Converts the ApiRGBColor object into the JSON object.
 * @memberof ApiRGBColor
 * @returns {JSON}
 */
ApiRGBColor.prototype.ToJSON = function(){ return new JSON(); };

/**
 * Returns a type of the ApiSchemeColor class.
 * @memberof ApiSchemeColor
 * @returns {"schemeColor"}
 */
ApiSchemeColor.prototype.GetClassType = function (){ return ""; };

/**
 * Converts the ApiSchemeColor object into the JSON object.
 * @memberof ApiSchemeColor
 * @returns {JSON}
 */
ApiSchemeColor.prototype.ToJSON = function(){ return new JSON(); };

/**
 * Returns a type of the ApiPresetColor class.
 * @memberof ApiPresetColor
 * @returns {"presetColor"}
 */
ApiPresetColor.prototype.GetClassType = function (){ return ""; };

/**
 * Converts the ApiPresetColor object into the JSON object.
 * @memberof ApiPresetColor
 * @returns {JSON}
 */
ApiPresetColor.prototype.ToJSON = function(){ return new JSON(); };

/**
 * Returns a type of the ApiInlineLvlSdt class.
 * @memberof ApiInlineLvlSdt
 * @returns {"inlineLvlSdt"}
 */
ApiInlineLvlSdt.prototype.GetClassType = function(){ return ""; };

/**
 * Returns an internal ID of the current content control.
 * @memberof ApiInlineLvlSdt
 * @returns {string}
 */
ApiInlineLvlSdt.prototype.GetInternalId = function(){ return ""; };

/**
 * Specifies a unique ID for the current content control.
 * @memberof ApiInlineLvlSdt
 * @since 8.3.2
 * @param {number} id - The numerical ID which will be specified for the current content control.
 * @returns {boolean}
 */
ApiInlineLvlSdt.prototype.SetId = function(id){ return true; };

/**
 * Returns a unique ID for the current content control.
 * @memberof ApiInlineLvlSdt
 * @since 8.3.2
 * @returns {string}
 */
ApiInlineLvlSdt.prototype.GetId = function(){ return ""; };

/**
 * Sets the lock to the current inline text content control:
 * <b>"unlocked"</b> - content can be edited and the container can be deleted.
 * <b>"contentLocked"</b> - content cannot be edited.
 * <b>"sdtContentLocked"</b> - content cannot be edited and the container cannot be deleted.
 * <b>"sdtLocked"</b> - the container cannot be deleted.
 * @memberof ApiInlineLvlSdt
 * @param {"unlocked" | "contentLocked" | "sdtContentLocked" | "sdtLocked"} lockType - The lock type applied to the inline text content control.
 * @returns {boolean}
 */
ApiInlineLvlSdt.prototype.SetLock = function(lockType){ return true; };

/**
 * Returns the lock type of the current container.
 * @memberof ApiInlineLvlSdt
 * @returns {SdtLock}
 */
ApiInlineLvlSdt.prototype.GetLock = function(){ return new SdtLock(); };

/**
 * Adds a string tag to the current inline text content control.
 * @memberof ApiInlineLvlSdt
 * @param {string} sTag - The tag which will be added to the current inline text content control.
 * @returns {boolean}
 */
ApiInlineLvlSdt.prototype.SetTag = function(sTag){ return true; };

/**
 * Returns the tag attribute for the current container.
 * @memberof ApiInlineLvlSdt
 * @returns {string}
 */
ApiInlineLvlSdt.prototype.GetTag = function(){ return ""; };

/**
 * Adds a string label to the current inline text content control.
 * @memberof ApiInlineLvlSdt
 * @param {string} sLabel - The label which will be added to the current inline text content control. Can be a positive or negative integer from <b>-2147483647</b> to <b>2147483647</b>.
 * @returns {boolean}
 */
ApiInlineLvlSdt.prototype.SetLabel = function(sLabel){ return true; };

/**
 * Returns the label attribute for the current container.
 * @memberof ApiInlineLvlSdt
 * @returns {string}
 */
ApiInlineLvlSdt.prototype.GetLabel = function(){ return ""; };

/**
 * Sets the alias attribute to the current container.
 * @memberof ApiInlineLvlSdt
 * @param {string} sAlias - The alias which will be added to the current inline text content control.
 * @returns {boolean}
 */
ApiInlineLvlSdt.prototype.SetAlias = function(sAlias){ return true; };

/**
 * Returns the alias attribute for the current container.
 * @memberof ApiInlineLvlSdt
 * @returns {string}
 */
ApiInlineLvlSdt.prototype.GetAlias = function(){ return ""; };

/**
 * Returns a number of elements in the current inline text content control. The text content 
 * control is created with one text run present in it by default, so even without any 
 * element added this method will return the value of '1'.
 * @memberof ApiInlineLvlSdt
 * @returns {number}
 */
ApiInlineLvlSdt.prototype.GetElementsCount = function(){ return 0; };

/**
 * Returns an element of the current inline text content control using the position specified.
 * @memberof ApiInlineLvlSdt
 * @param {number} nPos - The position where the element which content we want to get must be located.
 * @returns {ParagraphContent}
 */
ApiInlineLvlSdt.prototype.GetElement = function(nPos){ return new ParagraphContent(); };

/**
 * Removes an element using the position specified from the current inline text content control.
 * @memberof ApiInlineLvlSdt
 * @param {number} nPos - The position of the element which we want to remove from the current inline text content control.
 * @returns {boolean}
 */
ApiInlineLvlSdt.prototype.RemoveElement = function(nPos){ return true; };

/**
 * Removes all the elements from the current inline text content control.
 * @memberof ApiInlineLvlSdt
 * @returns {boolean} - returns false if control has not elements.
 */
ApiInlineLvlSdt.prototype.RemoveAllElements = function(){ return true; };

/**
 * Adds an element to the inline text content control.
 * @memberof ApiInlineLvlSdt
 * @param {ParagraphContent} oElement - The document element which will be added at the position specified. Returns <b>false</b> if the type of *oElement* is not supported by an inline text content control.
 * @param {number} [nPos] - The position of the element where it will be added to the current inline text content control. If this value is not specified, then the element will be added to the end of the current inline text content control.
 * @returns {boolean} - returns false if oElement unsupported.
 */
ApiInlineLvlSdt.prototype.AddElement = function(oElement, nPos){ return true; };

/**
 * Adds an element to the end of inline text content control.
 * @memberof ApiInlineLvlSdt
 * @param {DocumentElement} oElement - The document element which will be added to the end of the container.
 * @returns {boolean} - returns false if oElement unsupported.
 */
ApiInlineLvlSdt.prototype.Push = function(oElement){ return true; };

/**
 * Adds text to the current content control. 
 * @memberof ApiInlineLvlSdt
 * @param {String} sText - The text which will be added to the content control.
 * @returns {boolean} - returns false if param is invalid.
 */
ApiInlineLvlSdt.prototype.AddText = function(sText){ return true; };

/**
 * Removes a content control and its content. If keepContent is true, the content is not deleted.
 * @memberof ApiInlineLvlSdt
 * @param {boolean} keepContent - Specifies if the content will be deleted or not.
 * @returns {boolean} - returns false if control haven't parent paragraph.
 */
ApiInlineLvlSdt.prototype.Delete = function(keepContent){ return true; };

/**
 * Applies text settings to the content of the content control.
 * @memberof ApiInlineLvlSdt
 * @param {ApiTextPr} oTextPr - The properties that will be set to the content of the content control.
 * @returns {ApiInlineLvlSdt} this.
 */
ApiInlineLvlSdt.prototype.SetTextPr = function(oTextPr){ return new ApiInlineLvlSdt(); };

/**
 * Returns a paragraph that contains the current content control.
 * @memberof ApiInlineLvlSdt
 * @returns {ApiParagraph | null} - returns null if parent paragraph doesn't exist.
 */
ApiInlineLvlSdt.prototype.GetParentParagraph = function(){ return new ApiParagraph(); };

/**
 * Returns a content control that contains the current content control.
 * @memberof ApiInlineLvlSdt
 * @returns {ApiBlockLvlSdt | ApiInlineLvlSdt | null} - returns null if parent content control doesn't exist.
 */
ApiInlineLvlSdt.prototype.GetParentContentControl = function(){ return new ApiBlockLvlSdt(); };

/**
 * Returns a table that contains the current content control.
 * @memberof ApiInlineLvlSdt
 * @returns {ApiTable | null} - returns null if parent table doesn't exist.  
 */
ApiInlineLvlSdt.prototype.GetParentTable = function(){ return new ApiTable(); };

/**
 * Returns a table cell that contains the current content control.
 * @memberof ApiInlineLvlSdt
 * @returns {ApiTableCell | null} - return null if parent cell doesn't exist.  
 */
ApiInlineLvlSdt.prototype.GetParentTableCell = function(){ return new ApiTableCell(); };

/**
 * Returns a Range object that represents the part of the document contained in the specified content control.
 * @memberof ApiInlineLvlSdt
 * @param {Number} Start - Start position index in the current element.
 * @param {Number} End - End position index in the current element.
 * @returns {ApiRange} 
 */
ApiInlineLvlSdt.prototype.GetRange = function(Start, End){ return new ApiRange(); };

/**
 * Creates a copy of an inline content control. Ignores comments, footnote references, complex fields.
 * @memberof ApiInlineLvlSdt
 * @returns {ApiInlineLvlSdt}
 */
ApiInlineLvlSdt.prototype.Copy = function(){ return new ApiInlineLvlSdt(); };

/**
 * Converts the ApiInlineLvlSdt object into the JSON object.
 * @memberof ApiInlineLvlSdt
 * @param {boolean} bWriteStyles - Specifies if the used styles will be written to the JSON object or not.
 * @returns {JSON}
 */
ApiInlineLvlSdt.prototype.ToJSON = function(bWriteStyles){ return new JSON(); };

/**
 * Returns the placeholder text from the current inline content control.
 * @memberof ApiInlineLvlSdt
 * @returns {string}
 */
ApiInlineLvlSdt.prototype.GetPlaceholderText = function(){ return ""; };

/**
 * Sets the placeholder text to the current inline content control.
 * *Can't be set to checkbox or radio button*
 * @memberof ApiInlineLvlSdt
 * @param {string} sText - The text that will be set to the current inline content control.
 * @returns {boolean}
 */
ApiInlineLvlSdt.prototype.SetPlaceholderText = function(sText){ return true; };

/**
 * Checks if the content control is a form.
 * @memberof ApiInlineLvlSdt
 * @returns {boolean}
 */
ApiInlineLvlSdt.prototype.IsForm = function(){ return true; };

/**
 * Adds a comment to the current inline content control.
 * <note>Please note that this inline content control must be in the document.</note>
 * @memberof ApiInlineLvlSdt
 * @param {string} sText - The comment text.
 * @param {string} [sAuthor] - The author's name.
 * @param {string} [sUserId] - The user ID of the comment author.
 * @returns {ApiComment} - Returns null if the comment was not added.
 */
ApiInlineLvlSdt.prototype.AddComment = function(sText, sAuthor, sUserId){ return new ApiComment(); };

/**
 * Places a cursor before/after the current content control.
 * @param {boolean} [isAfter=true] - Specifies whether a cursor will be placed before (false) or after (true) the current content control.
 * @memberof ApiInlineLvlSdt
 * @returns {boolean}
 * @since 8.1.0
 */
ApiInlineLvlSdt.prototype.MoveCursorOutside = function(isAfter){ return true; };

/**
 * Returns a list of values of the combo box / drop-down list content control.
 * @memberof ApiInlineLvlSdt
 * @returns {ApiContentControlList}
 */
ApiInlineLvlSdt.prototype.GetDropdownList = function(){ return new ApiContentControlList(); };

/**
 * Sets the border color to the current content control.
 * @memberof ApiInlineLvlSdt
 * @param {byte} r - Red color component value.
 * @param {byte} g - Green color component value.
 * @param {byte} b - Blue color component value.
 * @param {byte} a - Alpha color component value.
 * @since 8.3.2
 * @returns {boolean}
 */
ApiInlineLvlSdt.prototype.SetBorderColor = function(r, g, b, a){ return true; };

/**
 * Returns the border color of the current content control.
 * @memberof ApiInlineLvlSdt
 * @since 8.3.2
 * @returns {null | {r:byte, g:byte, b:byte, a:byte}}
 */
ApiInlineLvlSdt.prototype.GetBorderColor = function(){ return null; };

/**
 * Sets the background color to the current content control.
 * @memberof ApiInlineLvlSdt
 * @param {byte} r - Red color component value.
 * @param {byte} g - Green color component value.
 * @param {byte} b - Blue color component value.
 * @param {byte} a - Alpha color component value.
 * @returns {boolean}
 */
ApiInlineLvlSdt.prototype.SetBackgroundColor = function(r, g, b, a){ return true; };

/**
 * Returns the background color of the current content control.
 * @memberof ApiInlineLvlSdt
 * @since 8.3.2
 * @returns {null | {r:byte, g:byte, b:byte, a:byte}}
 */
ApiInlineLvlSdt.prototype.GetBackgroundColor = function(){ return null; };

/**
 * Selects the current content control.
 * @memberof ApiInlineLvlSdt
 * @since 9.0.0
 * @returns {boolean}
 */
ApiInlineLvlSdt.prototype.Select = function(){ return true; };

/**
 * Sets the data binding for the current content control.
 * @memberof ApiInlineLvlSdt
 * @since 9.0.0
 * @param {XmlMapping | null} xmlMapping - The data binding to associate with the content control.
 * @returns {boolean}
 */
ApiInlineLvlSdt.prototype.SetDataBinding = function(xmlMapping){ return true; };

/**
 * Retrieves the data binding of the content control.
 * @memberof ApiInlineLvlSdt
 * @since 9.0.0
 * @returns {XmlMapping} Returns the data binding of the content control if it exists, otherwise `null`.
 */
ApiInlineLvlSdt.prototype.GetDataBinding = function(){ return new XmlMapping(); };

/**
 * Updates the content control using the value from the XML mapping.
 * @memberof ApiInlineLvlSdt
 * @since 9.0.0
 * @returns {boolean} Returns `true` if the update was successful, otherwise `false`.
 */
ApiInlineLvlSdt.prototype.UpdateFromXmlMapping = function(){ return true; };

/**
 * Returns the content control data for the XML mapping.
 * @memberof ApiInlineLvlSdt
 * @since 9.0.0
 * @returns {string} The string data representing the contents of the current content control.
 */
ApiInlineLvlSdt.prototype.GetDataForXmlMapping = function(){ return ""; };

/**
 * Checks if the content control is a checkbox.
 * @memberof ApiInlineLvlSdt
 * @since 9.0.0
 * @returns {boolean} Returns `true` if the content control is a checkbox, otherwise `false`.
 */
ApiInlineLvlSdt.prototype.IsCheckBox = function(){ return true; };

/**
 * Sets the checkbox value for the content control.
 * This method updates the checkbox state of the content control to either checked or unchecked.
 * @memberof ApiInlineLvlSdt
 * @since 9.0.0
 * @param {boolean} isChecked - The state to set for the checkbox. `true` for checked, `false` for unchecked.
 * @returns {boolean} Returns `true` if the checkbox value was successfully set, `false` if the content control is not a checkbox.
 */
ApiInlineLvlSdt.prototype.SetCheckBoxChecked = function(isChecked){ return true; };

/**
 * Determines whether a checkbox content control is currently checked or unchecked.
 *
 * Throws: Error if the content control is not a checkbox.
 *
 * @memberof ApiInlineLvlSdt
 * @since 9.0.0
 * @returns {boolean} Returns `true` if the checkbox is checked, `false` if the checkbox is unchecked.
 */
ApiInlineLvlSdt.prototype.IsCheckBoxChecked = function(){ return true; };

/**
 * Checks whether the content control is a picture control.
 * This method verifies if the content control is specifically a picture control.
 * @memberof ApiInlineLvlSdt
 * @since 9.0.0
 * @returns {boolean} Returns `true` if the content control is a picture, otherwise `false`.
 */
ApiInlineLvlSdt.prototype.IsPicture = function(){ return true; };

/**
 * Sets the size for the picture in a content control.
 * This method adjusts the width and height of the image if the content control is a picture.
 * @memberof ApiInlineLvlSdt
 * @since 9.0.0
 * @param {EMU} width - The desired image width .
 * @param {EMU} height - The desired image height.
 * @returns {boolean} Returns `true` if the size was successfully set, or `false` if the content control is not a picture.
 */
ApiInlineLvlSdt.prototype.SetPictureSize = function(width, height){ return true; };

/**
 * Sets the content (image) for the picture content control.
 * This method updates the picture inside a content control by setting an image from a provided URL.
 * The URL should be an internet link to the image.
 * @memberof ApiInlineLvlSdt
 * @since 9.0.0
 * @param {string} imageUrl - The URL of the image to be used for the content control.
 * Currently, only internet URLs are supported.
 * @returns {boolean} Returns `true` if the image was successfully set, otherwise `false`.
 */
ApiInlineLvlSdt.prototype.SetPicture = function(imageUrl){ return true; };

/**
 * Checks whether the content control is a drop-down list.
 * @memberof ApiInlineLvlSdt
 * @since 9.0.0
 * @returns {boolean} Returns `true` if the content control is a drop-down list, otherwise `false`.
 */
ApiInlineLvlSdt.prototype.IsDropDownList = function(){ return true; };

/**
 * Checks whether the content control is a combo box list.
 * @memberof ApiInlineLvlSdt
 * @since 9.0.0
 * @returns {boolean} Returns `true` if the content control is a combo box list, otherwise `false`.
 */
ApiInlineLvlSdt.prototype.IsComboBox = function(){ return true; };

/**
 * Sets the selected item for a combo box list or drop-down list.
 * @memberof ApiInlineLvlSdt
 * @since 9.0.0
 * @param {string} name - The name of the item to be selected in the list.
 * @returns {boolean} Returns `true` if the item was successfully selected, otherwise `false`.
 */
ApiInlineLvlSdt.prototype.SelectListItem = function(name){ return true; };

/**
 * Adds an item to a combo box list or drop-down list.
 * @memberof ApiInlineLvlSdt
 * @since 9.0.0
 * @param {string} name - The name of the item to add to the list.
 * @param {string} value - The value of the item to add to the list.
 * @param {number} [pos] - The optional position at which to insert the new item in the list.
 * @returns {boolean} Returns `true` if the item was successfully added, otherwise `false`.
 */
ApiInlineLvlSdt.prototype.AddListItem = function(name, value, pos){ return true; };

/**
 * Removes an item from a combo box list or drop-down list.
 * @memberof ApiInlineLvlSdt
 * @since 9.0.0
 * @param {string} value - The value of the item to remove from the list.
 * @returns {boolean} Returns `true` if the item was successfully removed, otherwise `false`.
 */
ApiInlineLvlSdt.prototype.RemoveListItem = function(value){ return true; };

/**
 * Checks whether the content control is a datepicker.
 * @memberof ApiInlineLvlSdt
 * @since 9.0.0
 * @returns {boolean} Returns `true` if the content control is a datepicker, otherwise `false`.
 */
ApiInlineLvlSdt.prototype.IsDatePicker = function(){ return true; };

/**
 * Sets the value for the datepicker content control.
 * @memberof ApiInlineLvlSdt
 * @since 9.0.0
 * @param {Date} date - The date value to set for the datepicker.
 * @returns {boolean} Returns `true` if the date was successfully set, otherwise `false`.
 */
ApiInlineLvlSdt.prototype.SetDate = function(date){ return true; };

/**
 * Retrieves the selected date value from a date picker content control and returns it as a Date object.
 *
 * Throws: Error if the content control is not a date picker.
 *
 * @memberof ApiInlineLvlSdt
 * @since 9.0.0
 * @returns {undefined | Date} Date object representing the selected date in the date picker control, or undefined if the form is a placeholder.
 */
ApiInlineLvlSdt.prototype.GetDate = function(){ return undefined; };

/**
 * Sets the date format for the datepicker content control.
 * This method allows setting the format in which the date should be displayed in the datepicker content control.
 * The format string should be specified using common date format patterns (e.g., "mm.dd.yyyy").
 * @memberof ApiInlineLvlSdt
 * @since 9.0.0
 * @param {string} dateFormat - The desired date format (e.g., "mm.dd.yyyy").
 * @returns {boolean} Returns `true` if the date format was successfully set, otherwise `false`.
 */
ApiInlineLvlSdt.prototype.SetDateFormat = function(dateFormat){ return true; };

/**
 * Sets the visualization type of the content control.
 * @memberof ApiInlineLvlSdt
 * @since 9.0.0
 * @param {"boundingBox"|"hidden"} type - The desired visualization type.
 */
ApiInlineLvlSdt.prototype.SetAppearance = function(type){};

/**
 * Returns the visualization type of the content control.
 * @memberof ApiInlineLvlSdt
 * @since 9.0.0
 * @returns {"boundingBox"|"hidden"} type - The visualization type of the content control.
 */
ApiInlineLvlSdt.prototype.GetAppearance = function(){ return ""; };

/**
 * Returns a type of the ApiContentControlList class.
 * @memberof ApiContentControlList
 * @returns {"contentControlList"}
 */
ApiContentControlList.prototype.GetClassType = function(){ return ""; };

/**
 * Returns a collection of items (the ApiContentControlListEntry objects) of the combo box / drop-down list content control.
 * @memberof ApiContentControlList
 * @returns {ApiContentControlListEntry[]}
 */
ApiContentControlList.prototype.GetAllItems = function(){ return [new ApiContentControlListEntry()]; };

/**
 * Returns a number of items of the combo box / drop-down list content control.
 * @memberof ApiContentControlList
 * @returns {number}
 */
ApiContentControlList.prototype.GetElementsCount = function(){ return 0; };

/**
 * Returns a parent of the combo box / drop-down list content control.
 * @memberof ApiContentControlList
 * @returns {ApiInlineLvlSdt | ApiBlockLvlSdt}
 */
ApiContentControlList.prototype.GetParent = function(){ return new ApiInlineLvlSdt(); };

/**
 * Adds a new value to the combo box / drop-down list content control.
 * @memberof ApiContentControlList
 * @param {string} sText - The display text for the list item.
 * @param {string} sValue - The list item value. By default is equal to sText parameter
 * @param {number} [nIndex=-1] - A position where a new value will be added. If nIndex=-1 add to the end.
 * @returns {boolean}
 */
ApiContentControlList.prototype.Add = function(sText, sValue, nIndex){ return true; };

/**
 * Clears a list of values of the combo box / drop-down list content control.
 * @memberof ApiContentControlList
 * @returns {boolean}
 */
ApiContentControlList.prototype.Clear = function(){ return true; };

/**
 * Returns an item of the combo box / drop-down list content control by the position specified in the request.
 * @memberof ApiContentControlList
 * @param {number} nIndex - Item position.
 * @returns {ApiContentControlListEntry}
 */
ApiContentControlList.prototype.GetItem = function(nIndex){ return new ApiContentControlListEntry(); };

/**
 * Returns a type of the ApiContentControlListEntry class.
 * @memberof ApiContentControlListEntry
 * @returns {"contentControlList"}
 */
ApiContentControlListEntry.prototype.GetClassType = function(){ return ""; };

/**
 * Returns a parent of the content control list item in the combo box / drop-down list content control.
 * @memberof ApiContentControlListEntry
 * @returns {ApiContentControlList}
 */
ApiContentControlListEntry.prototype.GetParent = function(){ return new ApiContentControlList(); };

/**
 * Selects the list entry in the combo box / drop-down list content control and sets the text of the content control to the selected item value.
 * @memberof ApiContentControlListEntry
 * @returns {boolean}
 */
ApiContentControlListEntry.prototype.Select = function(){ return true; };

/**
 * Moves the current item in the parent combo box / drop-down list content control up one element.
 * @memberof ApiContentControlListEntry
 * @returns {boolean}
 */
ApiContentControlListEntry.prototype.MoveUp = function(){ return true; };

/**
 * Moves the current item in the parent combo box / drop-down list content control down one element, so that it is after the item that originally followed it.
 * @memberof ApiContentControlListEntry
 * @returns {boolean}
 */
ApiContentControlListEntry.prototype.MoveDown = function(){ return true; };

/**
 * Returns an index of the content control list item in the combo box / drop-down list content control.
 * @memberof ApiContentControlListEntry
 * @returns {number}
 */
ApiContentControlListEntry.prototype.GetIndex = function(){ return 0; };

/**
 * Sets an index to the content control list item in the combo box / drop-down list content control.
 * @memberof ApiContentControlListEntry
 * @param {number} nIndex - An index of the content control list item.
 * @returns {boolean}
 */
ApiContentControlListEntry.prototype.SetIndex = function(nIndex){ return true; };

/**
 * Deletes the specified item in the combo box / drop-down list content control.
 * @memberof ApiContentControlListEntry
 * @returns {boolean}
 */
ApiContentControlListEntry.prototype.Delete = function(){ return true; };

/**
 * Returns a String that represents the display text of a list item for the combo box / drop-down list content control.
 * @memberof ApiContentControlListEntry
 * @returns {string}
 */
ApiContentControlListEntry.prototype.GetText = function(){ return ""; };

/**
 * Sets a String that represents the display text of a list item for the combo box / drop-down list content control.
 * @memberof ApiContentControlListEntry
 * @param {string} sText - The display text of a list item.
 * @returns {boolean}
 */
ApiContentControlListEntry.prototype.SetText = function(sText){ return true; };

/**
 * Returns a String that represents the value of a list item for the combo box / drop-down list content control.
 * @memberof ApiContentControlListEntry
 * @returns {string}
 */
ApiContentControlListEntry.prototype.GetValue = function(){ return ""; };

/**
 * Sets a String that represents the value of a list item for the combo box / drop-down list content control.
 * @memberof ApiContentControlListEntry
 * @param {string} sValue - The value of a list item.
 * @returns {boolean}
 */
ApiContentControlListEntry.prototype.SetValue = function(sValue){ return true; };

/**
 * Returns a type of the ApiBlockLvlSdt class.
 * @memberof ApiBlockLvlSdt
 * @returns {"blockLvlSdt"}
 */
ApiBlockLvlSdt.prototype.GetClassType = function(){ return ""; };

/**
 * Returns an internal id of the current content control.
 * @memberof ApiBlockLvlSdt
 * @returns {string}
 */
ApiBlockLvlSdt.prototype.GetInternalId = function(){ return ""; };

/**
 * Specifies a unique ID for the current content control.
 * @method
 * @memberof ApiBlockLvlSdt
 * @since 8.3.2
 * @param {number} id - The numerical ID which will be specified for the current content control.
 */
ApiBlockLvlSdt.prototype.SetId = ApiInlineLvlSdt.prototype.SetId;{};

/**
 * Returns a unique ID for the current content control.
 * @memberof ApiBlockLvlSdt
 * @since 8.3.2
 * @returns {string}
 */
ApiBlockLvlSdt.prototype.GetId = function(){ return ""; };

/**
 * Sets the lock to the current block text content control:
 * <b>"unlocked"</b> - content can be edited and the container can be deleted.
 * <b>"contentLocked"</b> - content cannot be edited.
 * <b>"sdtContentLocked"</b> - content cannot be edited and the container cannot be deleted.
 * <b>"sdtLocked"</b> - the container cannot be deleted.
 * @method
 * @memberof ApiBlockLvlSdt
 * @param {"unlocked" | "contentLocked" | "sdtContentLocked" | "sdtLocked"} lockType - The type of the lock applied to the block text content control.
 * @returns {boolean}
 */
ApiBlockLvlSdt.prototype.SetLock = ApiInlineLvlSdt.prototype.SetLock;{ return true; };

/**
 * Returns the lock type of the current container.
 * @memberof ApiBlockLvlSdt
 * @returns {SdtLock}
 */
ApiBlockLvlSdt.prototype.GetLock = function(){ return new SdtLock(); };

/**
 * Sets the tag attribute to the current container.
 * @memberof ApiBlockLvlSdt
 * @param {string} tag - The tag which will be added to the current container.
 * @returns {boolean}
 */
ApiBlockLvlSdt.prototype.SetTag = function(tag){ return true; };

/**
 * Returns the tag attribute for the current container.
 * @memberof ApiBlockLvlSdt
 * @returns {string}
 */
ApiBlockLvlSdt.prototype.GetTag = function(){ return ""; };

/**
 * Sets the label attribute to the current container.
 * @memberof ApiBlockLvlSdt
 * @param {string} label - The label which will be added to the current container. Can be a positive or negative integer from <b>-2147483647</b> to <b>2147483647</b>.
 * @returns {boolean}
 */
ApiBlockLvlSdt.prototype.SetLabel = function(label){ return true; };

/**
 * Returns the label attribute for the current container.
 * @memberof ApiBlockLvlSdt
 * @returns {string}
 */
ApiBlockLvlSdt.prototype.GetLabel = function(){ return ""; };

/**
 * Sets the data binding for the content control.
 * @memberof ApiBlockLvlSdt
 * @since 9.0.0
 * @param {XmlMapping | null} xmlMapping - The data binding to associate with the content control.
 * @returns {boolean}
 */
ApiBlockLvlSdt.prototype.SetDataBinding = function(xmlMapping){ return true; };

/**
 * Sets the content (image) for the picture content control.
 * This method updates the picture inside a content control by setting an image from a provided URL.
 * The URL should be an internet link to the image.
 * @memberof ApiBlockLvlSdt
 * @since 9.0.0
 * @param {string} imageUrl - The URL of the image to be used for the content control.
 * Currently, only internet URLs are supported.
 * @returns {boolean} Returns `true` if the image was successfully set, otherwise `false`.
 */
ApiBlockLvlSdt.prototype.SetPicture = function(imageUrl){ return true; };

/**
 * Checks whether the content control is a picture control.
 * This method verifies if the content control is specifically a picture control.
 * @memberof ApiBlockLvlSdt
 * @since 9.0.0
 * @returns {boolean} Returns `true` if the content control is a picture, otherwise `false`.
 */
ApiBlockLvlSdt.prototype.IsPicture = function(){ return true; };

/**
 * Retrieves the data binding of the content control.
 * @memberof ApiBlockLvlSdt
 * @since 9.0.0
 * @returns {XmlMapping} Returns the data binding of the content control if it exists, otherwise `null`.
 */
ApiBlockLvlSdt.prototype.GetDataBinding = function(){ return new XmlMapping(); };

/**
 * Updates the content control using the value from the XML mapping.
 * @method
 * @memberof ApiBlockLvlSdt
 * @since 9.0.0
 * @returns {boolean} Returns `true` if the update was successful, otherwise `false`.
 */
ApiBlockLvlSdt.prototype.UpdateFromXmlMapping = ApiInlineLvlSdt.prototype.UpdateFromXmlMapping;{ return true; };

/**
 * Returns the content control data for the XML mapping.
 * @method
 * @memberof ApiBlockLvlSdt
 * @since 9.0.0
 * @returns {string} The string data representing the contents of the current content control.
 */
ApiBlockLvlSdt.prototype.GetDataForXmlMapping = ApiInlineLvlSdt.prototype.GetDataForXmlMapping;{ return ""; };

/**
 * Sets the alias attribute to the current container.
 * @memberof ApiBlockLvlSdt
 * @param {string} alias - The alias which will be added to the current container.
 * @returns {boolean}
 */
ApiBlockLvlSdt.prototype.SetAlias = function(alias){ return true; };

/**
 * Returns the alias attribute for the current container.
 * @memberof ApiBlockLvlSdt
 * @returns {string}
 */
ApiBlockLvlSdt.prototype.GetAlias = function(){ return ""; };

/**
 * Returns the content of the current container.
 * @memberof ApiBlockLvlSdt
 * @returns {ApiDocumentContent}
 */
ApiBlockLvlSdt.prototype.GetContent = function(){ return new ApiDocumentContent(); };

/**
 * Returns a collection of content control objects in the current content control.
 * @memberof ApiBlockLvlSdt
 * @returns {ApiBlockLvlSdt[] | ApiInlineLvlSdt[]}
 */
ApiBlockLvlSdt.prototype.GetAllContentControls = function(){ return [new ApiBlockLvlSdt()]; };

/**
 * Returns a collection of paragraph objects in the current content control.
 * @memberof ApiBlockLvlSdt
 * @returns {ApiParagraph[]}
 */
ApiBlockLvlSdt.prototype.GetAllParagraphs = function(){ return [new ApiParagraph()]; };

/**
 * Returns a collection of tables on a given absolute page.
 * <note>This method can be a little bit slow, because it runs the document calculation
 * process to arrange tables on the specified page.</note>
 * @memberof ApiBlockLvlSdt
 * @param page - Page number. If it is not specified, an empty array will be returned.
 * @returns {ApiTable[]}  
 */
ApiBlockLvlSdt.prototype.GetAllTablesOnPage = function(page){ return [new ApiTable()]; };

/**
 * Clears the contents from the current content control.
 * @memberof ApiBlockLvlSdt
 * @returns {boolean} - returns true.
 */
ApiBlockLvlSdt.prototype.RemoveAllElements = function(){ return true; };

/**
 * Removes a content control and its content. If keepContent is true, the content is not deleted.
 * @memberof ApiBlockLvlSdt
 * @param {boolean} keepContent - Specifies if the content will be deleted or not.
 * @returns {boolean} - returns false if content control haven't parent.
 */
ApiBlockLvlSdt.prototype.Delete = function(keepContent){ return true; };

/**
 * Applies text settings to the content of the content control.
 * @memberof ApiBlockLvlSdt
 * @param {ApiTextPr} textPr - The properties that will be set to the content of the content control.
 * @returns {boolean}
 */
ApiBlockLvlSdt.prototype.SetTextPr = function(textPr){ return true; };

/**
 * Returns a collection of drawing objects in the current content control.
 * @memberof ApiBlockLvlSdt
 * @returns {Drawing[]}  
 */
ApiBlockLvlSdt.prototype.GetAllDrawingObjects = function(){ return [new Drawing()]; };

/**
 * Returns a content control that contains the current content control.
 * @memberof ApiBlockLvlSdt
 * @returns {ApiBlockLvlSdt | null} - returns null if parent content control doesn't exist.  
 */
ApiBlockLvlSdt.prototype.GetParentContentControl = function(){ return new ApiBlockLvlSdt(); };

/**
 * Returns a table that contains the current content control.
 * @memberof ApiBlockLvlSdt
 * @returns {ApiTable | null} - returns null is parent table does'n exist.  
 */
ApiBlockLvlSdt.prototype.GetParentTable = function(){ return new ApiTable(); };

/**
 * Returns a table cell that contains the current content control.
 * @memberof ApiBlockLvlSdt
 * @returns {ApiTableCell | null} - returns null if parent cell doesn't exist.  
 */
ApiBlockLvlSdt.prototype.GetParentTableCell = function(){ return new ApiTableCell(); };

/**
 * Pushes a paragraph or a table or a block content control to actually add it to the current container.
 * @memberof ApiBlockLvlSdt
 * @param {DocumentElement} element - The type of the element which will be pushed to the current container.
 * @returns {boolean} - returns false if element unsupported.
 */
ApiBlockLvlSdt.prototype.Push = function(element){ return true; };

/**
 * Adds a paragraph or a table or a block content control to the current container.
 * @memberof ApiBlockLvlSdt
 * @param {DocumentElement} element - The type of the element which will be added to the current container.
 * @param {Number} pos - The specified position.
 * @returns {boolean} - returns false if element unsupported.
 */
ApiBlockLvlSdt.prototype.AddElement = function(element, pos){ return true; };

/**
 * Adds a text to the current content control.
 * @memberof ApiBlockLvlSdt
 * @param {String} text - The text which will be added to the content control.
 * @returns {boolean} - returns false if param is invalid.
 */
ApiBlockLvlSdt.prototype.AddText = function(text){ return true; };

/**
 * Returns a Range object that represents the part of the document contained in the specified content control.
 * @memberof ApiBlockLvlSdt
 * @param {Number} start - Start position index in the current element.
 * @param {Number} end - End position index in the current element.
 * @returns {ApiRange} 
 */
ApiBlockLvlSdt.prototype.GetRange = function(start, end){ return new ApiRange(); };

/**
 * Creates a copy of a block content control. Ignores comments, footnote references, complex fields.
 * @memberof ApiBlockLvlSdt
 * @returns {ApiBlockLvlSdt}
 * @since 8.3.0
 */
ApiBlockLvlSdt.prototype.Copy = function(){ return new ApiBlockLvlSdt(); };

/**
 * Searches for a scope of a content control object. The search results are a collection of ApiRange objects.
 * @memberof ApiBlockLvlSdt
 * @param {string} text - Search string.
 * @param {boolean} isMatchCase - Case sensitive or not.
 * @returns {ApiRange[]}  
 */
ApiBlockLvlSdt.prototype.Search = function(text, isMatchCase){ return [new ApiRange()]; };

/**
 * Selects the current content control.
 * @memberof ApiBlockLvlSdt
 * @returns {boolean}
 */
ApiBlockLvlSdt.prototype.Select = function(){ return true; };

/**
 * Returns the placeholder text from the current content control.
 * @memberof ApiBlockLvlSdt
 * @returns {string}
 */
ApiBlockLvlSdt.prototype.GetPlaceholderText = function(){ return ""; };

/**
 * Sets the placeholder text to the current content control.
 * @memberof ApiBlockLvlSdt
 * @param {string} text - The text that will be set to the current content control.
 * @returns {boolean}
 */
ApiBlockLvlSdt.prototype.SetPlaceholderText = function(text){ return true; };

/**
 * Returns the content control position within its parent element.
 * @memberof ApiBlockLvlSdt
 * @returns {Number} - returns -1 if the content control parent doesn't exist. 
 */
ApiBlockLvlSdt.prototype.GetPosInParent = function(){ return 0; };

/**
 * Replaces the current content control with a new element.
 * @memberof ApiBlockLvlSdt
 * @param {DocumentElement} oElement - The element to replace the current content control with.
 * @returns {boolean}
 */
ApiBlockLvlSdt.prototype.ReplaceByElement = function(oElement){ return true; };

/**
 * Adds a comment to the current block content control.
 * <note>Please note that the current block content control must be in the document.</note>
 * @memberof ApiBlockLvlSdt
 * @param {string} text - The comment text.
 * @param {string} [author] - The author's name.
 * @param {string} [userId] - The user ID of the comment author.
 * @returns {ApiComment} - Returns null if the comment was not added.
 */
ApiBlockLvlSdt.prototype.AddComment = function(text, author, userId){ return new ApiComment(); };

/**
 * Adds a caption paragraph after (or before) the current content control.
 * <note>Please note that the current content control must be in the document (not in the footer/header).
 * And if the current content control is placed in a shape, then a caption is added after (or before) the parent shape.</note>
 * @memberof ApiBlockLvlSdt
 * @param {string} additionalText - The additional text.
 * @param {CaptionLabel | String} [label="Table"] - The caption label.
 * @param {boolean} [excludeLabel=false] - Specifies whether to exclude the label from the caption.
 * @param {CaptionNumberingFormat} [numFormat="Arabic"] - The possible caption numbering format.
 * @param {boolean} [isBefore=false] - Specifies whether to insert the caption before the current content control (true) or after (false) (after/before the shape if it is placed in the shape).
 * @param {Number} [headingLvl=undefined] - The heading level (used if you want to specify the chapter number).
 * <note>If you want to specify "Heading 1", then nHeadingLvl === 0 and etc.</note>
 * @param {CaptionSep} [captionSep="hyphen"] - The caption separator (used if you want to specify the chapter number).
 * @returns {boolean}
 */
ApiBlockLvlSdt.prototype.AddCaption = function(additionalText, label, excludeLabel, numFormat, isBefore, headingLvl, captionSep){ return true; };

/**
 * Returns a list of values of the combo box / drop-down list content control.
 * @memberof ApiBlockLvlSdt
 * @returns {ApiContentControlList}
 */
ApiBlockLvlSdt.prototype.GetDropdownList = function(){ return new ApiContentControlList(); };

/**
 * Places a cursor before/after the current content control.
 * @param {boolean} [isAfter=true] - Specifies whether a cursor will be placed before (false) or after (true) the current content control.
 * @memberof ApiBlockLvlSdt
 * @returns {boolean}
 * @since 8.1.0
 */
ApiBlockLvlSdt.prototype.MoveCursorOutside = function(isAfter){ return true; };

/**
 * Creates a copy of an block content control. Ignores comments, footnote references, complex fields.
 * @memberof ApiBlockLvlSdt
 * @returns {ApiBlockLvlSdt}
 */
ApiBlockLvlSdt.prototype.Copy = function(){ return new ApiBlockLvlSdt(); };

/**
 * Sets the border color to the current content control.
 * @method
 * @memberof ApiBlockLvlSdt
 * @param {byte} r - Red color component value.
 * @param {byte} g - Green color component value.
 * @param {byte} b - Blue color component value.
 * @param {byte} a - Alpha color component value.
 * @since 8.3.2
 * @returns {boolean}
 */
ApiBlockLvlSdt.prototype.SetBorderColor = ApiInlineLvlSdt.prototype.SetBorderColor;{ return true; };

/**
 * Returns the border color of the current content control.
 * @method
 * @memberof ApiBlockLvlSdt
 * @since 8.3.2
 * @returns {null | {r:byte, g:byte, b:byte, a:byte}}
 */
ApiBlockLvlSdt.prototype.GetBorderColor = ApiInlineLvlSdt.prototype.GetBorderColor;{ return null; };

/**
 * Sets the background color to the current content control.
 * @memberof ApiBlockLvlSdt
 * @method
 * @param {byte} r - Red color component value.
 * @param {byte} g - Green color component value.
 * @param {byte} b - Blue color component value.
 * @param {byte} a - Alpha color component value.
 * @returns {boolean}
 */
ApiBlockLvlSdt.prototype.SetBackgroundColor = ApiInlineLvlSdt.prototype.SetBackgroundColor;{ return true; };

/**
 * Returns the background color of the current content control.
 * @memberof ApiBlockLvlSdt
 * @method
 * @since 8.3.2
 * @returns {null | {r:byte, g:byte, b:byte, a:byte}}
 */
ApiBlockLvlSdt.prototype.GetBackgroundColor = ApiInlineLvlSdt.prototype.GetBackgroundColor;{ return null; };

/**
 * Sets the visualization of the content control.
 *
 * @method
 * @memberof ApiBlockLvlSdt
 * @since 9.0.0
 * @param {"boundingBox"|"hidden"} type - The desired type of visualization.
 */
ApiBlockLvlSdt.prototype.SetAppearance = ApiInlineLvlSdt.prototype.SetAppearance;{};

/**
 * Gets the visualization of the content control.
 *
 * @method
 * @memberof ApiBlockLvlSdt
 * @since 9.0.0
 * @returns {"boundingBox"|"hidden"} type - The type of visualization.
 */
ApiBlockLvlSdt.prototype.GetAppearance = ApiInlineLvlSdt.prototype.GetAppearance;{ return ""; };

/**
 * Returns a type of the ApiFormBase class.
 * @memberof ApiFormBase
 * @returns {"form"}
 */
ApiFormBase.prototype.GetClassType = function(){ return ""; };

/**
 * Returns a type of the current form.
 * @memberof ApiFormBase
 * @returns {FormType}
 */
ApiFormBase.prototype.GetFormType = function(){ return new FormType(); };

/**
 * Returns the current form key.
 * @memberof ApiFormBase
 * @returns {string}
 */
ApiFormBase.prototype.GetFormKey = function(){ return ""; };

/**
 * Sets a key to the current form.
 * @memberof ApiFormBase
 * @param {string} sKey - Form key.
 * @returns {boolean}
 */
ApiFormBase.prototype.SetFormKey = function(sKey){ return true; };

/**
 * Returns the tip text of the current form.
 * @memberof ApiFormBase
 * @returns {string}
 */
ApiFormBase.prototype.GetTipText = function(){ return ""; };

/**
 * Sets the tip text to the current form.
 * @memberof ApiFormBase
 * @param {string} sText - Tip text.
 * @returns {boolean}
 */
ApiFormBase.prototype.SetTipText = function(sText){ return true; };

/**
 * Checks if the current form is required.
 * @memberof ApiFormBase
 * @returns {boolean}
 */
ApiFormBase.prototype.IsRequired = function(){ return true; };

/**
 * Specifies if the current form should be required.
 * @memberof ApiFormBase
 * @param {boolean} bRequired - Defines if the current form is required (true) or not (false).
 * @returns {boolean}
 */
ApiFormBase.prototype.SetRequired = function(bRequired){ return true; };

/**
 * Checks if the current form is fixed size.
 * @memberof ApiFormBase
 * @returns {boolean}
 */
ApiFormBase.prototype.IsFixed = function(){ return true; };

/**
 * Converts the current form to a fixed size form.
 * @memberof ApiFormBase
 * @param {twips} width - The wrapper shape width measured in twentieths of a point (1/1440 of an inch).
 * @param {twips} height - The wrapper shape height measured in twentieths of a point (1/1440 of an inch).
 * @param {boolean} keepPosition - Save position on the page (it can be a little bit slow, because it runs the document calculation).
 * @returns {boolean}
 */
ApiFormBase.prototype.ToFixed = function(width, height, keepPosition){ return true; };

/**
 * Converts the current form to an inline form.
 * *Picture form can't be converted to an inline form, it's always a fixed size object.*
 * @memberof ApiFormBase
 * @returns {boolean}
 */
ApiFormBase.prototype.ToInline = function(){ return true; };

/**
 * Sets the border color to the current form.
 * @memberof ApiFormBase
 * @param {byte} r - Red color component value.
 * @param {byte} g - Green color component value.
 * @param {byte} b - Blue color component value.
 * @param {boolean} bNone - Defines that border color will not be set.
 * @returns {boolean}
 */
ApiFormBase.prototype.SetBorderColor = function(r, g, b, bNone){ return true; };

/**
 * Sets the background color to the current form.
 * @memberof ApiFormBase
 * @param {byte} r - Red color component value.
 * @param {byte} g - Green color component value.
 * @param {byte} b - Blue color component value.
 * @param {boolean} bNone - Defines that background color will not be set.
 * @returns {boolean}
 */
ApiFormBase.prototype.SetBackgroundColor = function(r, g, b, bNone){ return true; };

/**
 * Returns the text from the current form.
 * @memberof ApiFormBase
 * @returns {string}
 */
ApiFormBase.prototype.GetText = function(){ return ""; };

/**
 * Clears the current form.
 * @memberof ApiFormBase
 * @returns {boolean}
 */
ApiFormBase.prototype.Clear = function(){ return true; };

/**
 * Returns a shape in which the form is placed to control the position and size of the fixed size form frame.
 * The null value will be returned for the inline forms.
 * @memberof ApiFormBase
 * @returns {ApiShape} - returns the shape in which the form is placed.
 */
ApiFormBase.prototype.GetWrapperShape = function(){ return new ApiShape(); };

/**
 * Sets the placeholder text to the current form.
 * *Can't be set to checkbox or radio button.*
 * @memberof ApiFormBase
 * @param {string} sText - The text that will be set to the current form.
 * @returns {boolean}
 */
ApiFormBase.prototype.SetPlaceholderText = function(sText){ return true; };

/**
 * Sets the text properties to the current form.
 * *Used if possible for this type of form*
 * @memberof ApiFormBase
 * @param {ApiTextPr} textPr - The text properties that will be set to the current form.
 * @returns {boolean}  
 */
ApiFormBase.prototype.SetTextPr = function(textPr){ return true; };

/**
 * Returns the text properties from the current form.
 * *Used if possible for this type of form*
 * @memberof ApiFormBase
 * @returns {ApiTextPr}  
 */
ApiFormBase.prototype.GetTextPr = function(){ return new ApiTextPr(); };

/**
 * Places a cursor before/after the current form.
 * @param {boolean} [isAfter=true] - Specifies whether a cursor will be placed before (false) or after (true) the current form.
 * @memberof ApiFormBase
 * @returns {boolean}
 * @since 8.1.0
 */
ApiFormBase.prototype.MoveCursorOutside = function(isAfter){ return true; };

/**
 * Copies the current form (copies with the shape if it exists).
 * @memberof ApiFormBase
 * @returns {ApiForm}
 */
ApiFormBase.prototype.Copy = function(){ return new ApiForm(); };

/**
 * Returns the tag attribute for the current form.
 * @memberof ApiFormBase
 * @since 9.0.0
 * @returns {string}
 */
ApiFormBase.prototype.GetTag = function(){ return ""; };

/**
 * Sets the tag attribute to the current form.
 * @memberof ApiFormBase
 * @since 9.0.0
 * @param {string} tag - The tag which will be added to the current container.
 * @returns {boolean}
 */
ApiFormBase.prototype.SetTag = function(tag){ return true; };

/**
 * Returns the role of the current form.
 * @memberof ApiFormBase
 * @since 9.0.0
 * @returns {string}
 */
ApiFormBase.prototype.GetRole = function(){ return ""; };

/**
 * Sets the role to the current form.
 * @memberof ApiFormBase
 * @since 9.0.0
 * @param {string} role - The role which will be attached to the current form.
 * @returns {boolean}
 */
ApiFormBase.prototype.SetRole = function(role){ return true; };

/**
 * Returns a type of the ApiTextForm class.
 * @memberof ApiTextForm
 * @since 9.0.4
 * @returns {"textForm"}
 */
ApiTextForm.prototype.GetClassType = function(){ return ""; };

/**
 * Checks if the text field content is autofit, i.e. whether the font size adjusts to the size of the fixed size form.
 * @memberof ApiTextForm
 * @returns {boolean}
 */
ApiTextForm.prototype.IsAutoFit = function(){ return true; };

/**
 * Specifies if the text field content should be autofit, i.e. whether the font size adjusts to the size of the fixed size form.
 * @memberof ApiTextForm
 * @param {boolean} bAutoFit - Defines if the text field content is autofit (true) or not (false).
 * @returns {boolean}
 */
ApiTextForm.prototype.SetAutoFit = function(bAutoFit){ return true; };

/**
 * Checks if the current text field is multiline.
 * @memberof ApiTextForm
 * @returns {boolean}
 */
ApiTextForm.prototype.IsMultiline = function(){ return true; };

/**
 * Specifies if the current text field should be miltiline.
 * @memberof ApiTextForm
 * @param {boolean} bMultiline - Defines if the current text field is multiline (true) or not (false).
 * @returns {boolean} - return false, if the text field is not fixed size.
 */
ApiTextForm.prototype.SetMultiline = function(bMultiline){ return true; };

/**
 * Returns a limit of the text field characters.
 * @memberof ApiTextForm
 * @returns {number} - if this method returns -1 -> the form has no limit for characters
 */
ApiTextForm.prototype.GetCharactersLimit = function(){ return 0; };

/**
 * Sets a limit to the text field characters.
 * @memberof ApiTextForm
 * @param {number} nChars - The maximum number of characters in the text field. If this parameter is equal to -1, no limit will be set.
 * A limit is required to be set if a comb of characters is applied.
 * Maximum value for this parameter is 1000000.
 * @returns {boolean}
 */
ApiTextForm.prototype.SetCharactersLimit = function(nChars){ return true; };

/**
 * Checks if the text field is a comb of characters with the same cell width.
 * @memberof ApiTextForm
 * @returns {boolean}
 */
ApiTextForm.prototype.IsComb = function(){ return true; };

/**
 * Specifies if the text field should be a comb of characters with the same cell width.
 * The maximum number of characters must be set to a positive value.
 * @memberof ApiTextForm
 * @param {boolean} bComb - Defines if the text field is a comb of characters (true) or not (false).
 * @returns {boolean}
 */
ApiTextForm.prototype.SetComb = function(bComb){ return true; };

/**
 * Sets the cell width to the applied comb of characters.
 * @memberof ApiTextForm
 * @param {mm} [nCellWidth=0] - The cell width measured in millimeters.
 * If this parameter is not specified or equal to 0 or less, then the width will be set automatically. Must be >= 1 and <= 558.8.
 * @returns {boolean}
 */
ApiTextForm.prototype.SetCellWidth = function(nCellWidth){ return true; };

/**
 * Sets the text to the current text field.
 * @memberof ApiTextForm
 * @param {string} sText - The text that will be set to the current text field.
 * @returns {boolean}
 */
ApiTextForm.prototype.SetText = function(sText){ return true; };

/**
 * Returns a type of the ApiPictureForm class.
 * @memberof ApiPictureForm
 * @returns {"pictureForm"}
 * @since 9.0.4
 */
ApiPictureForm.prototype.GetClassType = function(){ return ""; };

/**
 * Returns the current scaling condition of the picture form.
 * @memberof ApiPictureForm
 * @returns {ScaleFlag}
 */
ApiPictureForm.prototype.GetScaleFlag = function(){ return new ScaleFlag(); };

/**
 * Sets the scaling condition to the current picture form.
 * @memberof ApiPictureForm
 * @param {ScaleFlag} sScaleFlag - Picture scaling condition: "always", "never", "tooBig" or "tooSmall".
 * @returns {boolean}
 */
ApiPictureForm.prototype.SetScaleFlag = function(sScaleFlag){ return true; };

/**
 * Locks the aspect ratio of the current picture form.
 * @memberof ApiPictureForm
 * @param {boolean} [isLock=true] - Specifies if the aspect ratio of the current picture form will be locked (true) or not (false).
 * @returns {boolean}
 */
ApiPictureForm.prototype.SetLockAspectRatio = function(isLock){ return true; };

/**
 * Checks if the aspect ratio of the current picture form is locked or not.
 * @memberof ApiPictureForm
 * @returns {boolean}
 */
ApiPictureForm.prototype.IsLockAspectRatio = function(){ return true; };

/**
 * Sets the picture position inside the current form:
 * <b>0</b> - the picture is placed on the left/top;
 * <b>50</b> - the picture is placed in the center;
 * <b>100</b> - the picture is placed on the right/bottom.
 * @memberof ApiPictureForm
 * @param {percentage} nShiftX - Horizontal position measured in percent.
 * @param {percentage} nShiftY - Vertical position measured in percent.
 * @returns {boolean}
 */
ApiPictureForm.prototype.SetPicturePosition = function(nShiftX, nShiftY){ return true; };

/**
 * Returns the picture position inside the current form.
 * @memberof ApiPictureForm
 * @returns {Array.<percentage>} Array of two numbers [shiftX, shiftY]
 */
ApiPictureForm.prototype.GetPicturePosition = function(){ return []; };

/**
 * Respects the form border width when scaling the image.
 * @memberof ApiPictureForm
 * @param {boolean} [isRespect=true] - Specifies if the form border width will be respected (true) or not (false).
 * @returns {boolean}
 */
ApiPictureForm.prototype.SetRespectBorders = function(isRespect){ return true; };

/**
 * Checks if the form border width is respected or not.
 * @memberof ApiPictureForm
 * @returns {boolean}
 */
ApiPictureForm.prototype.IsRespectBorders = function(){ return true; };

/**
 * Returns an image in the base64 format from the current picture form.
 * @memberof ApiPictureForm
 * @returns {Base64Img}
 */
ApiPictureForm.prototype.GetImage = function(){ return base64img; };

/**
 * Sets an image to the current picture form.
 * @memberof ApiPictureForm
 * @param {string} sImageSrc - The image source where the image to be inserted should be taken from (currently, only internet URL or base64 encoded images are supported).
 * @param {EMU} nWidth - The image width in English measure units.
 * @param {EMU} nHeight - The image height in English measure units.
 * @returns {boolean}
 */
ApiPictureForm.prototype.SetImage = function(sImageSrc, nWidth, nHeight){ return true; };

/**
 * Returns a type of the ApiComboBoxForm class.
 * @memberof ApiComboBoxForm
 * @returns {"comboBoxForm"}
 * @since 9.0.4
 */
ApiComboBoxForm.prototype.GetClassType = function(){ return ""; };

/**
 * Returns the list values from the current combo box.
 * @memberof ApiComboBoxForm
 * @returns {string[]}
 */
ApiComboBoxForm.prototype.GetListValues = function(){ return [""]; };

/**
 * Sets the list values to the current combo box.
 * @memberof ApiComboBoxForm
 * @param {string[]} aListString - The combo box list values.
 * @returns {boolean}
 */
ApiComboBoxForm.prototype.SetListValues = function(aListString){ return true; };

/**
 * Selects the specified value from the combo box list values. 
 * @memberof ApiComboBoxForm
 * @param {string} sValue - The combo box list value that will be selected.
 * @returns {boolean}
 */
ApiComboBoxForm.prototype.SelectListValue = function(sValue){ return true; };

/**
 * Sets the text to the current combo box.
 * *Available only for editable combo box forms.*
 * @memberof ApiComboBoxForm
 * @param {string} sText - The combo box text.
 * @returns {boolean}
 */
ApiComboBoxForm.prototype.SetText = function(sText){ return true; };

/**
 * Checks if the combo box text can be edited. If it is not editable, then this form is a drop-down list.
 * @memberof ApiComboBoxForm
 * @returns {boolean}
 */
ApiComboBoxForm.prototype.IsEditable = function(){ return true; };

/**
 * Returns a type of the ApiCheckBoxForm class.
 * @memberof ApiCheckBoxForm
 * @returns {"checkBoxForm"}
 * @since 9.0.4
 */
ApiCheckBoxForm.prototype.GetClassType = function(){ return ""; };

/**
 * Checks the current checkbox.
 * @memberof ApiCheckBoxForm
 * @param {boolean} isChecked - Specifies if the current checkbox will be checked (true) or not (false).
 * @returns {boolean}
 */
ApiCheckBoxForm.prototype.SetChecked = function(isChecked){ return true; };

/**
 * Returns the state of the current checkbox (checked or not).
 * @memberof ApiCheckBoxForm
 * @returns {boolean}
 */
ApiCheckBoxForm.prototype.IsChecked = function(){ return true; };

/**
 * Checks if the current checkbox is a radio button. 
 * @memberof ApiCheckBoxForm
 * @returns {boolean}
 */
ApiCheckBoxForm.prototype.IsRadioButton = function(){ return true; };

/**
 * Returns the radio group key if the current checkbox is a radio button.
 * @memberof ApiCheckBoxForm
 * @returns {string}
 */
ApiCheckBoxForm.prototype.GetRadioGroup = function(){ return ""; };

/**
 * Sets the radio group key to the current radio button.
 * @memberof ApiCheckBoxForm
 * @param {string} sKey - Radio group key.
 * @returns {boolean}
 */
ApiCheckBoxForm.prototype.SetRadioGroup = function(sKey){ return true; };

/**
 * Returns the choice name of the current radio button.
 * @memberof ApiCheckBoxForm
 * @since 8.3.2
 * @returns {string}
 * */
ApiCheckBoxForm.prototype.GetChoiceName = function(){ return ""; };

/**
 * Sets the choice name for the current radio button.
 * @memberof ApiCheckBoxForm
 * @param {string} choiceName - The radio button choice name.
 * @since 8.3.2
 * @returns {boolean}
 * */
ApiCheckBoxForm.prototype.SetChoiceName = function(choiceName){ return true; };

/**
 * Returns a type of the ApiDateForm class.
 * @memberof ApiDateForm
 * @returns {"dateForm"}
 * @since 9.0.4
 */
ApiDateForm.prototype.GetClassType = function(){ return ""; };

/**
 * Gets the date format of the current form.
 * @memberof ApiDateForm
 * @returns {string}
 * @since 8.1.0
 */
ApiDateForm.prototype.GetFormat = function() { return ""; };

/**
 * Sets the date format to the current form.
 * @memberof ApiDateForm
 * @param {string} sFormat - The date format. For example, mm.dd.yyyy
 * @returns {boolean}
 * @since 8.1.0
 */
ApiDateForm.prototype.SetFormat = function(sFormat){ return true; };

/**
 * Gets the used date language of the current form.
 * @memberof ApiDateForm
 * @returns {string}
 * @since 8.1.0
 */
ApiDateForm.prototype.GetLanguage = function() { return ""; };

/**
 * Sets the date language to the current form.
 * @memberof ApiDateForm
 * @param {string} sLangId - The date language. The possible value for this parameter is a language identifier as defined in
 * RFC 4646/BCP 47. Example: "en-CA".
 * @returns {boolean}
 * @since 8.1.0
 */
ApiDateForm.prototype.SetLanguage = function(sLangId){ return true; };

/**
 * Returns the timestamp of the current form.
 * @memberof ApiDateForm
 * @returns {undefined | number} The Unix timestamp in milliseconds, or undefined if the form is a placeholder.
 * @since 8.1.0
 */
ApiDateForm.prototype.GetTime = function(){ return undefined; };

/**
 * Sets the timestamp to the current form.
 * @memberof ApiDateForm
 * @param {number} nTimeStamp The timestamp that will be set to the current date form.
 * @returns {boolean}
 * @since 8.1.0
 */
ApiDateForm.prototype.SetTime = function(nTimeStamp){ return true; };

/**
 * Sets the date to the current form.
 * @memberof ApiDateForm
 * @param {Date | string} date - The date object or the date in the string format.
 * @returns {boolean}
 * @since 9.0.0
 */
ApiDateForm.prototype.SetDate = function(date){ return true; };

/**
 * Returns the date of the current form.
 * @memberof ApiDateForm
 * @returns {undefined | Date} - The date object, or undefined if the form is a placeholder.
 * @since 9.0.0
 */
ApiDateForm.prototype.GetDate = function(){ return undefined; };

/**
 * Returns a type of the ApiComplexForm class.
 * @memberof ApiComplexForm
 * @returns {"form"}
 * @since 9.0.4
 */
ApiComplexForm.prototype.GetClassType = function(){ return ""; };

/**
 * Appends the text content of the given form to the end of the current complex form.
 * @memberof ApiComplexForm
 * @param value {string | ApiDateForm | ApiPictureForm | ApiCheckBoxForm | ApiComboBoxForm | ApiTextForm} - The text or the form to add.
 * @returns {boolean}
 * @since 9.0.0
 */
ApiComplexForm.prototype.Add = function(value){ return true; };

/**
 * Returns an ordered list of subforms.
 * @memberof ApiComplexForm
 * @returns {ApiForm[]}
 * @since 9.0.0
 */
ApiComplexForm.prototype.GetSubForms = function(){ return [new ApiForm()]; };

/**
 * Clears all content from the current complex form, resetting it to its placeholder state.
 * @memberof ApiComplexForm
 * @returns {boolean}
 * @since 9.0.0
 */
ApiComplexForm.prototype.ClearContent = function(){ return true; };

/**
 * Converts the ApiBlockLvlSdt object into the JSON object.
 * @memberof ApiBlockLvlSdt
 * @param {boolean} bWriteNumberings - Specifies if the used numberings will be written to the JSON object or not.
 * @param {boolean} bWriteStyles - Specifies if the used styles will be written to the JSON object or not.
 * @returns {JSON}
 */
ApiBlockLvlSdt.prototype.ToJSON = function(bWriteNumberings, bWriteStyles){ return new JSON(); };

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
 * Converts a document to Markdown or HTML text.
 * @memberof ApiInterface
 * @param {"markdown" | "html"} [convertType="markdown"] - Conversion type.
 * @param {boolean} [htmlHeadings=false] - Defines if the HTML headings and IDs will be generated when the Markdown renderer of your target platform does not handle Markdown-style IDs.
 * @param {boolean} [base64img=false] - Defines if the images will be created in the base64 format.
 * @param {boolean} [demoteHeadings=false] - Defines if all heading levels in your document will be demoted to conform with the following standard: single H1 as title, H2 as top-level heading in the text body.
 * @param {boolean} [renderHTMLTags=false] - Defines if HTML tags will be preserved in your Markdown. If you just want to use an occasional HTML tag, you can avoid using the opening angle bracket
 * in the following way: \<tag&gt;text\</tag&gt;. By default, the opening angle brackets will be replaced with the special characters.
 * @returns {string}
 */
ApiInterface.prototype.ConvertDocument = function(convertType, htmlHeadings, base64img, demoteHeadings, renderHTMLTags){ return ""; };

/**
 * Creates the empty text properties.
 * @memberof ApiInterface
 * @returns {ApiTextPr}
 */
ApiInterface.prototype.CreateTextPr = function(){ return new ApiTextPr(); };

/**
 * Creates the empty paragraph properties.
 * @memberof ApiInterface
 * @returns {ApiTextPr}
 */
ApiInterface.prototype.CreateParaPr = function(){ return new ApiTextPr(); };

/**
 * Creates the empty table properties.
 * @memberof ApiInterface
 * @returns {ApiTextPr}
 */
ApiInterface.prototype.CreateTablePr = function(){ return new ApiTextPr(); };

/**
 * Creates the empty table row properties.
 * @memberof ApiInterface
 * @returns {ApiTextPr}
 */
ApiInterface.prototype.CreateTableRowPr = function(){ return new ApiTextPr(); };

/**
 * Creates the empty table cell properties.
 * @memberof ApiInterface
 * @returns {ApiTextPr}
 */
ApiInterface.prototype.CreateTableCellPr = function(){ return new ApiTextPr(); };

/**
 * Creates the empty table cell properties.
 * @memberof ApiInterface
 * @param {TableStyleOverrideType} sType - The table part.
 * @returns {ApiTextPr}
 */
ApiInterface.prototype.CreateTableStylePr = function(sType){ return new ApiTextPr(); };

/**
 * Creates a Text Art object with the parameters specified.
 * @memberof ApiInterface
 * @param {ApiTextPr} [textPr=Api.CreateTextPr()] - The text properties.
 * @param {string} [text="Your text here"] - The text for the Text Art object.
 * @param {TextTransform} [transform="textNoShape"] - Text transform type.
 * @param {ApiFill}   [fill=Api.CreateNoFill()] - The color or pattern used to fill the Text Art object.
 * @param {ApiStroke} [stroke=Api.CreateStroke(0, Api.CreateNoFill())] - The stroke used to create the Text Art object shadow.
 * @param {number} [rotAngle=0] - Rotation angle.
 * @param {EMU} [width=1828800] - The Text Art width measured in English measure units.
 * @param {EMU} [height=1828800] - The Text Art heigth measured in English measure units.
 * @returns {ApiDrawing}
 */
ApiInterface.prototype.CreateWordArt = function(textPr, text, transform, fill, stroke, rotAngle, width, height){ return new ApiDrawing(); };

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
 * Returns a type of the ApiComment class.
 * @memberof ApiComment
 * @returns {"comment"}
 */
ApiComment.prototype.GetClassType = function (){ return ""; };

/**
 * Returns the current comment ID. If the comment doesn't have an ID, null is returned.
 * @memberof ApiComment
 * @returns {string}
 */
ApiComment.prototype.GetId = function (){ return ""; };

/**
 * Returns the comment text.
 * @memberof ApiComment
 * @returns {string}
 */
ApiComment.prototype.GetText = function () { return ""; };

/**
 * Sets the comment text.
 * @memberof ApiComment
 * @param {string} sText - The comment text.
 * @returns {ApiComment} - this
 */
ApiComment.prototype.SetText = function (sText) { return new ApiComment(); };

/**
 * Returns the comment author's name.
 * @memberof ApiComment
 * @returns {string}
 */
ApiComment.prototype.GetAuthorName = function () { return ""; };

/**
 * Sets the comment author's name.
 * @memberof ApiComment
 * @param {string} sAuthorName - The comment author's name.
 * @returns {ApiComment} - this
 */
ApiComment.prototype.SetAuthorName = function (sAuthorName) { return new ApiComment(); };

/**
 * Returns the user ID of the comment author.
 * @memberof ApiComment
 * @returns {string}
 */
ApiComment.prototype.GetUserId = function () { return ""; };

/**
 * Sets the user ID to the comment author.
 * @memberof ApiComment
 * @param {string} sUserId - The user ID of the comment author.
 * @returns {ApiComment} - this
 */
ApiComment.prototype.SetUserId = function (sUserId) { return new ApiComment(); };

/**
 * Checks if a comment is solved or not.
 * @memberof ApiComment
 * @returns {boolean}
 */
ApiComment.prototype.IsSolved = function () { return true; };

/**
 * Marks a comment as solved.
 * @memberof ApiComment
 * @param {boolean} bSolved - Specifies if a comment is solved or not.
 * @returns {ApiComment} - this
 */
ApiComment.prototype.SetSolved = function (bSolved) { return new ApiComment(); };

/**
 * Returns the timestamp of the comment creation in UTC format.
 * @memberof ApiComment
 * @returns {Number}
 */
ApiComment.prototype.GetTimeUTC = function () { return 0; };

/**
 * Sets the timestamp of the comment creation in UTC format.
 * @memberof ApiComment
 * @param {Number | String} nTimeStamp - The timestamp of the comment creation in UTC format.
 * @returns {ApiComment} - this
 */
ApiComment.prototype.SetTimeUTC = function (timeStamp) { return new ApiComment(); };

/**
 * Returns the timestamp of the comment creation in the current time zone format.
 * @memberof ApiComment
 * @returns {Number}
 */
ApiComment.prototype.GetTime = function () { return 0; };

/**
 * Sets the timestamp of the comment creation in the current time zone format.
 * @memberof ApiComment
 * @param {Number | String} nTimeStamp - The timestamp of the comment creation in the current time zone format.
 * @returns {ApiComment} - this
 */
ApiComment.prototype.SetTime = function (timeStamp) { return new ApiComment(); };

/**
 * Returns the quote text of the current comment.
 * @memberof ApiComment
 * @returns {Number}
 */
ApiComment.prototype.GetQuoteText = function () { return 0; };

/**
 * Returns a number of the comment replies.
 * @memberof ApiComment
 * @returns {Number}
 */
ApiComment.prototype.GetRepliesCount = function () { return 0; };

/**
 * Returns the specified comment reply.
 * @memberof ApiComment
 * @param {Number} [nIndex = 0] - The comment reply index.
 * @returns {ApiCommentReply}
 */
ApiComment.prototype.GetReply = function (nIndex) { return new ApiCommentReply(); };

/**
 * Adds a reply to a comment.
 * @memberof ApiComment
 * @param {String} sText - The comment reply text (required).
 * @param {String} sAuthorName - The name of the comment reply author (optional).
 * @param {String} sUserId - The user ID of the comment reply author (optional).
 * @param {Number} [nPos=-1] - The comment reply position. If nPos=-1 add to the end.
 * @returns {ApiComment} - this
 */
ApiComment.prototype.AddReply = function (sText, sAuthorName, sUserId, nPos) { return new ApiComment(); };

/**
 * Removes the specified comment replies.
 * @memberof ApiComment
 * @param {Number} [nPos = 0] - The position of the first comment reply to remove.
 * @param {Number} [nCount = 1] - A number of comment replies to remove.
 * @param {boolean} [bRemoveAll = false] - Specifies whether to remove all comment replies or not.
 * @returns {ApiComment} - this
 */
ApiComment.prototype.RemoveReplies = function (nPos, nCount, bRemoveAll) { return new ApiComment(); };

/**
 * Deletes the current comment from the document.
 * @memberof ApiComment
 * @returns {boolean}
 */
ApiComment.prototype.Delete = function (){ return true; };

/**
 * Returns a type of the ApiCommentReply class.
 * @memberof ApiCommentReply
 * @returns {"commentReply"}
 */
ApiCommentReply.prototype.GetClassType = function () { return ""; };

/**
 * Returns the comment reply text.
 * @memberof ApiCommentReply
 * @returns {string}
 */
ApiCommentReply.prototype.GetText = function () { return ""; };

/**
 * Sets the comment reply text.
 * @memberof ApiCommentReply
 * @param {string} sText - The comment reply text.
 * @returns {ApiCommentReply} - this
 */
ApiCommentReply.prototype.SetText = function (sText) { return new ApiCommentReply(); };

/**
 * Returns the comment reply author's name.
 * @memberof ApiCommentReply
 * @returns {string}
 */
ApiCommentReply.prototype.GetAuthorName = function () { return ""; };

/**
 * Sets the comment reply author's name.
 * @memberof ApiCommentReply
 * @param {string} sAuthorName - The comment reply author's name.
 * @returns {ApiCommentReply} - this
 */
ApiCommentReply.prototype.SetAuthorName = function (sAuthorName) { return new ApiCommentReply(); };

/**
 * Returns the user ID of the comment reply author.
 * @memberof ApiCommentReply
 * @returns {string}
 */
ApiCommentReply.prototype.GetUserId = function () { return ""; };

/**
 * Sets the user ID to the comment reply author.
 * @memberof ApiCommentReply
 * @param {string} sUserId - The user ID of the comment reply author.
 * @returns {ApiCommentReply} - this
 */
ApiCommentReply.prototype.SetUserId = function (sUserId) { return new ApiCommentReply(); };

/**
 * Returns a type of the ApiWatermarkSettings class.
 * @memberof ApiWatermarkSettings
 * @returns {"watermarkSettings"}
 */
ApiWatermarkSettings.prototype.GetClassType = function(){ return ""; };

/**
 * Sets the type of the watermark in the document.
 * @memberof ApiWatermarkSettings
 * @param {WatermarkType} sType - The watermark type.
 * @returns {boolean}
 */
ApiWatermarkSettings.prototype.SetType = function (sType){ return true; };

/**
 * Returns the type of the watermark in the document.
 * @memberof ApiWatermarkSettings
 * @returns {WatermarkType}
 */
ApiWatermarkSettings.prototype.GetType = function (){ return new WatermarkType(); };

/**
 * Sets the text of the watermark in the document.
 * @memberof ApiWatermarkSettings
 * @param {string} sText - The watermark text.
 * @returns {boolean}
 */
ApiWatermarkSettings.prototype.SetText = function (sText){ return true; };

/**
 * Returns the text of the watermark in the document.
 * @memberof ApiWatermarkSettings
 * @returns {string | null}
 */
ApiWatermarkSettings.prototype.GetText = function (){ return ""; };

/**
 * Sets the text properties of the watermark in the document.
 * @memberof ApiWatermarkSettings
 * @param {ApiTextPr} oTextPr - The watermark text properties.
 * @returns {boolean}
 */
ApiWatermarkSettings.prototype.SetTextPr = function (oTextPr){ return true; };

/**
 * Returns the text properties of the watermark in the document.
 * @memberof ApiWatermarkSettings
 * @returns {ApiTextPr}
 */
ApiWatermarkSettings.prototype.GetTextPr = function (){ return new ApiTextPr(); };

/**
 * Sets the opacity of the watermark in the document.
 * @memberof ApiWatermarkSettings
 * @param {number} nOpacity - The watermark opacity. This value must be from 0 to 255.
 * @returns {boolean}
 */
ApiWatermarkSettings.prototype.SetOpacity = function (nOpacity){ return true; };

/**
 * Returns the opacity of the watermark in the document.
 * @memberof ApiWatermarkSettings
 * @returns {number} - The watermark opacity. This value must be from 0 to 255.
 */
ApiWatermarkSettings.prototype.GetOpacity = function (){ return 0; };

/**
 * Sets the direction of the watermark in the document.
 * @memberof ApiWatermarkSettings
 * @param {WatermarkDirection} sDirection - The watermark direction.
 * @returns {boolean}
 */
ApiWatermarkSettings.prototype.SetDirection = function (sDirection){ return true; };

/**
 * Returns the direction of the watermark in the document.
 * @memberof ApiWatermarkSettings
 * @returns {WatermarkDirection} - The watermark direction.
 */
ApiWatermarkSettings.prototype.GetDirection = function (){ return new WatermarkDirection(); };

/**
 * Sets the image URL of the watermark in the document.
 * @memberof ApiWatermarkSettings
 * @param {string} sURL - The watermark image URL.
 * @returns {boolean}
 */
ApiWatermarkSettings.prototype.SetImageURL = function (sURL){ return true; };

/**
 * Returns the image URL of the watermark in the document.
 * @memberof ApiWatermarkSettings
 * @returns {string | null} - The watermark image URL.
 */
ApiWatermarkSettings.prototype.GetImageURL = function (){ return ""; };

/**
 * Returns the width of the watermark image in the document.
 * @memberof ApiWatermarkSettings
 * @returns {EMU | null} - The watermark image width in EMU.
 */
ApiWatermarkSettings.prototype.GetImageWidth = function (){ return new EMU(); };

/**
 * Returns the height of the watermark image in the document.
 * @memberof ApiWatermarkSettings
 * @returns {EMU | null} - The watermark image height in EMU.
 */
ApiWatermarkSettings.prototype.GetImageHeight = function (){ return new EMU(); };

/**
 * Sets the size (width and height) of the watermark image in the document.
 * @memberof ApiWatermarkSettings
 * @param {EMU} nWidth - The watermark image width.
 * @param {EMU} nHeight - The watermark image height.
 * @returns {boolean}
 */
ApiWatermarkSettings.prototype.SetImageSize = function (nWidth, nHeight){ return true; };

/**
 * Moves a cursor to the current bookmark.
 * @memberof ApiBookmark
 * @returns {boolean}
 * @since 8.3.0
 */
ApiBookmark.prototype.GoTo = function(){ return true; };

/**
 * Selects the current bookmark.
 * @memberof ApiBookmark
 * @returns {boolean}
 * @since 8.3.0
 */
ApiBookmark.prototype.Select = function(){ return true; };

/**
 * Changes the bookmark name.
 * @memberof ApiBookmark
 * @param {string} sNewName - A new bookmark name.
 * @returns {boolean}
 * @since 8.3.0
 */
ApiBookmark.prototype.SetName = function(sNewName){ return true; };

/**
 * Returns the bookmark name.
 * @memberof ApiBookmark
 * @returns {string}
 * @since 8.3.0
 */
ApiBookmark.prototype.GetName = function(){ return ""; };

/**
 * Sets the bookmark text.
 * @memberof ApiBookmark
 * @param {string} sText - The bookmark text.
 * @returns {boolean}
 * @since 8.3.0
 */
ApiBookmark.prototype.SetText = function(sText){ return true; };

/**
 * Returns the bookmark text.
 * @memberof ApiBookmark
 * @param {object} oPr - The resulting string display properties.
 * @param {boolean} [oPr.Numbering=false] - Defines if the resulting string will include numbering or not.
 * @param {boolean} [oPr.Math=false] - Defines if the resulting string will include mathematical expressions or not.
 * @param {string} [oPr.NewLineSeparator='\r'] - Defines how the line separator will be specified in the resulting string. Any symbol can be used. The default separator is "\r".
 * @param {string} [oPr.TableCellSeparator='\t'] - Defines how the table cell separator will be specified in the resulting string. Any symbol can be used. The default separator is "\t".
 * @param {string} [oPr.TableRowSeparator='\r\n'] - Defines how the table row separator will be specified in the resulting string. Any symbol can be used. The default separator is "\r\n".
 * @param {string} [oPr.ParaSeparator='\r\n'] - Defines how the paragraph separator will be specified in the resulting string. Any symbol can be used. The default separator is "\r\n".
 * @param {string} [oPr.TabSymbol='\t'] - Defines how the tab will be specified in the resulting string (does not apply to numbering). Any symbol can be used. The default symbol is "\t".
 * @returns {string}
 * @since 8.3.0
 */
ApiBookmark.prototype.GetText = function(oPr){ return ""; };

/**
 * Returns the bookmark range.
 * @memberof ApiBookmark
 * @returns {ApiRange}
 * @since 8.3.0
 */
ApiBookmark.prototype.GetRange = function(){ return new ApiRange(); };

/**
 * Deletes the current bookmark from the document.
 * @memberof ApiBookmark
 * @returns {boolean}
 * @since 8.3.0
 */
ApiBookmark.prototype.Delete = function(){ return true; };

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
 * Common form properties.
 * @typedef {Object} FormPrBase
 * @property {string} key - The form key.
 * @property {string} tip - The form tip text.
 * @property {string} tag - The form tag.
 * @property {string} role - The role to fill out form.
 * @property {boolean} required - Specifies if the form is required or not.
 * @property {string} placeholder - The form placeholder text.
 */

/**
 * Specific text field properties.
 * @typedef {Object} TextFormPrBase
 * @property {boolean} comb - Specifies if the text field should be a comb of characters with the same cell width. The maximum number of characters must be set to a positive value.
 * @property {number} maxCharacters - The maximum number of characters in the text field.
 * @property {number} cellWidth - The cell width for each character measured in millimeters. If this parameter is not specified or equal to 0 or less, then the width will be set automatically.
 * @property {boolean} multiLine - Specifies if the current fixed size text field is multiline or not.
 * @property {boolean} autoFit - Specifies if the text field content should be autofit, i.e. whether the font size adjusts to the size of the fixed size form.
 */

/**
 * Text field properties.
 * @typedef {FormPrBase | TextFormPrBase} TextFormPr
 */

/**
 * Form insertion specific properties.
 * @typedef {Object} FormInsertPr
 * @property {boolean} [placeholderFromSelection=false] - Specifies if the currently selected text should be saved as a placeholder of the inserted form.
 * @property {boolean} [keepSelectedTextInForm=true] - Specifies if the currently selected text should be saved as the content of the inserted form.
 */

/**
 * Properties for inserting a text field.
 * @typedef {FormPrBase | TextFormPrBase | FormInsertPr} TextFormInsertPr
 */

/**
 * Specific checkbox / radio button properties.
 * @typedef {Object} CheckBoxFormPrBase
 * @property {boolean} radio - Specifies if the current checkbox is a radio button. In this case, the key parameter is considered as an identifier for the group of radio buttons.
 */

/**
 * Checkbox / radio button properties.
 * @typedef {FormPrBase | CheckBoxFormPrBase} CheckBoxFormPr
 */

/**
 * Specific combo box / dropdown list properties.
 * @typedef {Object} ComboBoxFormPrBase
 * @property {boolean} editable - Specifies if the combo box text can be edited.
 * @property {boolean} autoFit - Specifies if the combo box form content should be autofit, i.e. whether the font size adjusts to the size of the fixed size form.
 * @property {Array.<string | Array.<string>>} items - The combo box items.
     * This array consists of strings or arrays of two strings where the first string is the displayed value and the second one is its meaning.
     * If the array consists of single strings, then the displayed value and its meaning are the same.
     * Example: ["First", ["Second", "2"], ["Third", "3"], "Fourth"].

 */

/**
 * Combo box / dropdown list properties.
 * @typedef {FormPrBase | ComboBoxFormPrBase} ComboBoxFormPr
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
 * Specific picture form properties.
 * @typedef {Object} PictureFormPrBase
 * @property {ScaleFlag} scaleFlag - The condition to scale an image in the picture form: "always", "never", "tooBig" or "tooSmall".
 * @property {boolean} lockAspectRatio - Specifies if the aspect ratio of the picture form is locked or not.
 * @property {boolean} respectBorders - Specifies if the form border width is respected or not when scaling the image.
 * @property {percentage} shiftX - Horizontal picture position inside the picture form measured in percent:
 * <b>0</b> - the picture is placed on the left;
 * <b>50</b> - the picture is placed in the center;
 * <b>100</b> - the picture is placed on the right.
 * @property {percentage} shiftY - Vertical picture position inside the picture form measured in percent:
 * <b>0</b> - the picture is placed on top;
 * <b>50</b> - the picture is placed in the center;
 * <b>100</b> - the picture is placed on the bottom.
 */

/**
 * Picture form properties.
 * @typedef {FormPrBase | PictureFormPrBase} PictureFormPr
 */

/**
 * Specific date form properties.
 * @typedef {Object} DateFormPrBase
 * @property {string} format- The date format, ex: mm.dd.yyyy
 * @property {string} lang- The date language. Possible value for this parameter is a language identifier as defined by
 * RFC 4646/BCP 47. Example: "en-CA".
 */

/**
 * Date form properties.
 * @typedef {FormPrBase | DateFormPrBase} DateFormPr
 */

/**
 * Creates a text field with the specified text field properties.
 * @memberof ApiInterface
 * @param {TextFormPr} formPr - Text field properties.
 * @returns {ApiTextForm}
 */
ApiInterface.prototype.CreateTextForm = function(formPr){ return new ApiTextForm(); };

/**
 * Creates a checkbox / radio button with the specified checkbox / radio button properties.
 * @memberof ApiInterface
 * @param {CheckBoxFormPr} formPr - Checkbox / radio button properties.
 * @returns {ApiCheckBoxForm}
 */
ApiInterface.prototype.CreateCheckBoxForm = function(formPr){ return new ApiCheckBoxForm(); };

/**
 * Creates a combo box / dropdown list with the specified combo box / dropdown list properties.
 * @memberof ApiInterface
 * @param {ComboBoxFormPr} formPr - Combo box / dropdown list properties.
 * @returns {ApiComboBoxForm}
 */
ApiInterface.prototype.CreateComboBoxForm = function(formPr){ return new ApiComboBoxForm(); };

/**
 * Creates a picture form with the specified picture form properties.
 * @memberof ApiInterface
 * @param {PictureFormPr} formPr - Picture form properties.
 * @returns {ApiPictureForm}
 */
ApiInterface.prototype.CreatePictureForm = function(formPr){ return new ApiPictureForm(); };

/**
 * Creates a date form with the specified date form properties.
 * @memberof ApiInterface
 * @param {DateFormPr} formPr - Date form properties.
 * @returns {ApiDateForm}
 */
ApiInterface.prototype.CreateDateForm = function(formPr){ return new ApiDateForm(); };

/**
 * Creates a complex form with the specified complex form properties.
 * @memberof ApiInterface
 * @param {FormPrBase} formPr - Complex form properties.
 * @returns {ApiComplexForm}
 */
ApiInterface.prototype.CreateComplexForm = function(formPr){ return new ApiComplexForm(); };

/**
 * Inserts a text box with the specified text box properties over the selected text.
 * @memberof ApiDocument
 * @param {TextFormInsertPr} formPr - Properties for inserting a text field.
 * @returns {ApiTextForm}
 */
ApiDocument.prototype.InsertTextForm = function(formPr){ return new ApiTextForm(); };

/**
 * Class representing a collection of form roles.
 * @constructor
 * @since 9.0.0
 */
function ApiFormRoles(oform){}

/**
 * The date form properties.
 * @typedef {FormPrBase | DateFormPrBase} DateFormPr
 */

/**
 * The role properties.
 * @typedef {Object} RoleProperties
 * @property {string} color - The role color.
 */

/**
 * Returns a collection of form roles.
 * @since 9.0.0
 * @returns {ApiFormRoles}
 */
ApiDocument.prototype.GetFormRoles = function(){ return new ApiFormRoles(); };

/**
 * Adds a new form role.
 * @memberof ApiFormRoles
 * @since 9.0.0
 * @param {string} name - The name of role being added.
 * @param {RoleProperties} props - The role properties.
 * @returns {boolean}
 */
ApiFormRoles.prototype.Add = function(name, props){ return true; };

/**
 * Removes a role with the specified name.
 * @memberof ApiFormRoles
 * @since 9.0.0
 * @param {string} name - The name of role to be removed.
 * @param {string} [delegateRole] - The name of the role to which all forms bound to this role will be delegated.
 * @returns {boolean}
 */
ApiFormRoles.prototype.Remove = function(name, delegateRole){ return true; };

/**
 * Returns a number of form roles.
 * @memberof ApiFormRoles
 * @since 9.0.0
 * @returns {number}
 */
ApiFormRoles.prototype.GetCount = function(){ return 0; };

/**
 * Lists all available roles.
 * @memberof ApiFormRoles
 * @since 9.0.0
 * @returns {string[]}
 */
ApiFormRoles.prototype.GetAllRoles = function(){ return [""]; };

/**
 * Checks if a role with the specified name exists.
 * @memberof ApiFormRoles
 * @since 9.0.0
 * @param {string} name - The role name.
 * @returns {boolean}
 */
ApiFormRoles.prototype.HaveRole = function(name){ return true; };

/**
 * Returns the RGB color of the specified role.
 * @memberof ApiFormRoles
 * @since 9.0.0
 * @param {string} name - The role name.
 * @returns {null | {r:byte, g:byte, b:byte}}
 */
ApiFormRoles.prototype.GetRoleColor = function(name){ return null; };

/**
 * Sets the color for the specified role.
 * @memberof ApiFormRoles
 * @since 9.0.0
 * @param {string} name - The role name.
 * @param {string} color - The role color.
 * @returns {boolean}
 */
ApiFormRoles.prototype.SetRoleColor = function(name, color){ return true; };

/**
 * Moves a role up in filling order.
 * @memberof ApiFormRoles
 * @since 9.0.0
 * @param {string} name - The role name.
 * @returns {boolean}
 */
ApiFormRoles.prototype.MoveUp = function(name){ return true; };


