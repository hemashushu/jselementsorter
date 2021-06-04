const assert = require('assert/strict');
const domino = require('domino');

const { ObjectSorter } = require('jsobjectutils');
const { ElementSorter } = require('../index');

describe('ElementSorter Test', () => {
//     describe('parseCondition test', () => {
//         let c1 = ObjectSorter.parseOrderExpression('name');
//         assert.equal(1, c1.length);
//         assert.equal(c1[0].fieldName, 'name');
//         assert.equal(c1[0].isAscendingOrder, true);
//
//         let c2 = ObjectSorter.parseOrderExpression('number DESC');
//         assert.equal(1, c2.length);
//         assert.equal(c2[0].isAscendingOrder, false);
//         assert.equal(c2[0].fieldName, 'number');
//
//         let c3 = ObjectSorter.parseOrderExpression('number DESC, name');
//         assert.equal(2, c3.length);
//         assert.equal(c3[0].fieldName, 'number');
//         assert.equal(c3[0].isAscendingOrder, false);
//         assert.equal(c3[1].fieldName, 'name');
//         assert.equal(c3[1].isAscendingOrder, true);
//
//         let c4 = ObjectSorter.parseOrderExpression('id, number DESC, name');
//         assert.equal(3, c4.length);
//     });

    // 项目元素内容如下：
    // <div class="item" data-id="1" data-type="foo" data-color="red"></div>

    let itemObjectMapFunc = (element) => {
        // element.dataset 不可用，使用 getAttribute() 读取 'data-*' 属性值。
        let id = parseInt(element.getAttribute('data-id'), 10);
        let type = element.getAttribute('data-type');
        let checked = (element.getAttribute('data-checked') === 'true') ? true : false;

        return {
            id, type, checked
        };
    };

    let createContainerElement = () => {
        let html1 = '<div class="container"></div>';
        return domino.createDocument(html1, true).body.firstElementChild;
    };

    let createItemElements = () => {
        let html1 =
            '<div class="item" data-id="5" data-type="foo" data-checked="false">id5</div>' +
            '<div class="item" data-id="2" data-type="foo" data-checked="true">id2</div>' +
            '<div class="item" data-id="1" data-type="foo" data-checked="false">id1</div>' +
            '<div class="item" data-id="6" data-type="bar" data-checked="true">id6</div>' +
            '<div class="item" data-id="9" data-type="bar" data-checked="false">id9</div>' +
            '<div class="item" data-id="3" data-type="bar" data-checked="true">id3</div>'
        let doc1 = domino.createDocument(html1, true);
        let elementList1 = doc1.querySelectorAll('div');
        return Array.from(elementList1);
    };

    let getElementIds = (container) => {
        let ids = [];
        let elementList1 = container.querySelectorAll('div');
        for (let idx = 0; idx < elementList1.length; idx++) {
            let element = elementList1.item(idx);
            let id = parseInt(element.getAttribute('data-id'), 10);
            ids.push(id);
        }
        return ids;
    };

    let isMatchElementIds = (container, ids) => {
        let actualIds = getElementIds(container);
        for (let idx = 0; idx < ids.length; idx++) {
            if (ids[idx] !== actualIds[idx]) {
                return false;
            }
        }
        return true;
    }

    describe('insertElement test', () => {
        it('Test order by: id', () => {
            let containerElement1 = createContainerElement();
            let itemElements1 = createItemElements();
            let conditions1 = ObjectSorter.parseOrderExpression('id');
            let lastElements = [];

            // insert id5 -> [id5]
            ElementSorter.insertElement(containerElement1, lastElements,
                [itemElements1[0]], conditions1, itemObjectMapFunc);
            assert(isMatchElementIds(containerElement1, [5]));

            // insert id6 -> [id5, id6]
            ElementSorter.insertElement(containerElement1, lastElements,
                [itemElements1[3]], conditions1, itemObjectMapFunc);
            assert(isMatchElementIds(containerElement1, [5, 6]));

            // insert id3 -> [id3, id5, id6]
            ElementSorter.insertElement(containerElement1, lastElements,
                [itemElements1[5]], conditions1, itemObjectMapFunc);
            assert(isMatchElementIds(containerElement1, [3, 5, 6]));

            // insert id1, id2, id9
            ElementSorter.insertElement(containerElement1, lastElements,
                [itemElements1[2], itemElements1[1], itemElements1[4]], conditions1, itemObjectMapFunc);
            assert(isMatchElementIds(containerElement1, [1, 2, 3, 5, 6, 9]));
        });

        it('Test order by: id DESC', () => {
            let containerElement1 = createContainerElement();
            let itemElements1 = createItemElements();
            let conditions1 = ObjectSorter.parseOrderExpression('id DESC');
            let lastElements = [];

            // insert id5 -> [id5]
            ElementSorter.insertElement(containerElement1, lastElements,
                [itemElements1[0]], conditions1, itemObjectMapFunc);
            assert(isMatchElementIds(containerElement1, [5]));

            // insert id6 -> [id6, id5]
            ElementSorter.insertElement(containerElement1, lastElements,
                [itemElements1[3]], conditions1, itemObjectMapFunc);
            assert(isMatchElementIds(containerElement1, [6, 5]));

            // insert id3 -> [id6, id5, id3]
            ElementSorter.insertElement(containerElement1, lastElements,
                [itemElements1[5]], conditions1, itemObjectMapFunc);
            assert(isMatchElementIds(containerElement1, [6, 5, 3]));

            // insert id1, id2, id9
            ElementSorter.insertElement(containerElement1, lastElements,
                [itemElements1[2], itemElements1[1], itemElements1[4]], conditions1, itemObjectMapFunc);
            assert(isMatchElementIds(containerElement1, [9, 6, 5, 3, 2, 1]));
        });

        it('Test order by: checked, type DESC, id', () => {
            let containerElement1 = createContainerElement();
            let itemElements1 = createItemElements();
            let conditions1 = ObjectSorter.parseOrderExpression('checked, type DESC, id');
            let lastElements = [];

            ElementSorter.insertElement(containerElement1, lastElements,
                itemElements1, conditions1, itemObjectMapFunc);

            // 3 次排序的过程:
            // - 5,1,9 || 2,6,3              // 以 '||' 符号分组
            // - 5,1 -- 9 || 2 -- 6,3        // 以 '--' 符号分组
            // - 1 ++ 5 -- 9 || 2 -- 3 ++ 6  // 以 '++' 符号分组
            assert(isMatchElementIds(containerElement1, [1, 5, 9, 2, 3, 6]));
        });
    });

    describe('sortElements test', () => {
        it('Test sort by: id DESC', () => {
            let containerElement1 = createContainerElement();
            let itemElements1 = createItemElements();
            let lastElements = [];

            // [ 6, 9, 3, 5, 2, 1 ]
            let conditions1 = ObjectSorter.parseOrderExpression('type');
            ElementSorter.insertElement(containerElement1, lastElements,
                itemElements1, conditions1, itemObjectMapFunc);

            assert(isMatchElementIds(containerElement1, [6, 9, 3, 5, 2, 1]));

            // [ 9, 6, 5, 3, 2, 1 ]
            let conditions2 = ObjectSorter.parseOrderExpression('id DESC');
            ElementSorter.sortElements(containerElement1, lastElements,
                conditions2, itemObjectMapFunc);

            assert(isMatchElementIds(containerElement1, [9, 6, 5, 3, 2, 1]));

            // [3, 6, 9, 1, 2, 5]
            let conditions3 = ObjectSorter.parseOrderExpression('type, id');
            ElementSorter.sortElements(containerElement1, lastElements,
                conditions3, itemObjectMapFunc);

            assert(isMatchElementIds(containerElement1, [3, 6, 9, 1, 2, 5]));
        });
    });
});