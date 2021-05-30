const Condition = require('./condition');
const { ObjectUtils } = require('jsobjectutils');

/**
 * 对元素按条件进行排序的模块
 */
class ElementSorter {

    /**
     * 解析排序条件表达式（字符串）为一组排序条件对象（Condition）
     *
     * 排序表达式为一个以逗号分隔的，待排序的（项目对象的）属性名称拼接
     * 而成的字符串，比如：
     * 'name, size'
     *
     * 表示先以 'name' 排序，然后再以 'size' 排序，其中 name 和 size
     * 都是项目对象的属性名称。
     *
     * 如果项目对象的属性值是一个（子）对象，则可以通过名称路径（name path）来指定
     * 子对象的属性，比如：
     * 'meta.type, name'
     *
     * 表示先以子对象 meta 的属性 type 排序，然后再以 name 属性排序。
     *
     * 每个属性后面都可以添加 'DESC' 后缀，表示该属性值按 “倒序” 排序，比如：
     * 'meta.flag, creationTime DESC, name'
     *
     * 表示先按 'meta.flag' 正序排序，然后按 'creationTime' 倒序排序，最后
     * 按 'name' 正序排序。
     *
     * @param {*} expression 一个字符串，排序条件表达式。格式是以逗号分隔，
     *     拼接各个待排序的（项目对象的）属性名称。
     * @returns 返回 Condition 对象数组，[Condition, ...]
     */
    static parseCondition(expression) {
        let conditions = [];

        if (expression === '') {
            return conditions;
        }

        let segments = expression.split(',');
        for (let segment of segments) {
            segment = segment.trim();

            // 检查是否有 'DESC' 后缀
            if (segment.toLowerCase().endsWith('desc')) {
                // 倒序排序
                let fieldName = segment.substring(0, segment.length - 4);
                fieldName = fieldName.trim();
                let condition = new Condition(fieldName, false);
                conditions.push(condition);

            } else {
                // 正序排序
                let condition = new Condition(segment, true);
                conditions.push(condition);
            }
        }

        return conditions;
    }

    /**
     * 插入新的项目元素（item element）
     *
     * @param {*} containerElement 项目元素的父元素（DOM Element）
     * @param {*} lastElements [Element, ...] 已有的项目元素的数组，必须事先
     *     排好次序，可以是空数组。
     * @param {*} addElements [Element, ...] 待插入的项目元素
     * @param {*} conditions [Condition, ...] 排序条件对象数组
     * @param {*} itemObjectMapFunc 项目元素与项目对象的映射方法，
     *     该方法用于从项目元素（item element）获得相应的项目对象（item object），
     *     项目对象用于比较、排序。
     *     方法的签名是：
     *     itemObjectMapFunc(element)=>{
     *         return {...}; // item object
     *     }
     *     需要注意，项目对象的各属性的值必须确保是正确的数据类型，不能通通采用 String
     *     类型的数据， 否则排序结果会不正确。
     *     考虑到项目对象很大机率是从 Element 的 dataset 的值构造的，这些储存
     *     的值都是字符串类型，可以考虑使用 Number() 函数转换为数字：
     *
     *     - 是使用 Number() 方法/函数，而不是通过 new Number(...) 构造 Number 实例，
     *       方法和构造函数的返回值不同，方法返回的是基础数字类型，而构造函数返回的是 Number 实例，
     *       即 new Number('123') !== 123
     *     - Date 对象会被 Number() 函数转为数值。
     *     - null 会被 Number() 函数转换为 0
     *     - Boolean 会被 Number() 函数转换为数值，true 被转为 1, false 被
     *       转为 0。
     */
    static insertElement(containerElement, lastElements, addElements, conditions, itemObjectMapFunc) {
        let lastItemObjects = lastElements.map((element) => {
            return itemObjectMapFunc(element);
        });

        for (let addElement of addElements) {
            let addItemObject = itemObjectMapFunc(addElement);
            let position = ElementSorter._findPosition(lastItemObjects, addItemObject, conditions);

            if (position === -1) {
                lastItemObjects.push(addItemObject);
                containerElement.insertBefore(addElement, null);
                lastElements.push(addElement);
            } else {
                // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/splice
                lastItemObjects.splice(position, 0, addItemObject);
                containerElement.insertBefore(addElement, lastElements[position]);
                lastElements.splice(position, 0, addElement);
            }
        }
    }

    /**
     * 排序已有的项目元素（item elements）
     *
     * @param {*} container
     * @param {*} lastElements
     * @param {*} conditions
     * @param {*} itemObjectMapFunc
     */
    static sortElements(container, lastElements, conditions, itemObjectMapFunc) {
        // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/map
        let itemObjects = lastElements.map((element, idx) => {
            let itemObject = itemObjectMapFunc(element);
            itemObject.__index = idx; // 添加一个 '__index' 属性，用于记录原始的顺序
            return itemObject;
        });

        itemObjects.sort((leftItemObject, rightItemObject) => {
            return ElementSorter._compare(leftItemObject, rightItemObject, conditions);
        });

        let targetElementIndexies = itemObjects.map(item => item.__index);

        let lastElement = null;

        // 从最后一个项目元素开始改变顺序
        // 方法是根据已排好的次序，逐个取出对应的项目元素，然后插入到对应的位置，比如
        //
        // 2,3,0,1 <-- targetElementIndexies
        //
        // 第 0 次移动: 把索引值为 1 的 element 移动到倒数第 1 的位置（即最末尾）：
        //                  /--- lastElements
        //             [0][1][2][3][null] -> [0][2][3]|[1]
        //             lastElement ---^                 ^--- lastElement
        // 第 1 次移动: 把索引值为 0 的 element 移动到倒数第 2 的位置：
        //             [0][2][3]|[1] -> [2][3]|[0][1]
        //         lastElement ---^             ^--- lastElement
        // 第 2 次移动: 把索引值为 3 的 element 移动到倒数第 3 的位置：
        //             [2][3]|[0][1] -> [2]|[3][0][1]
        //      lastElement ---^             ^--- lastElement
        //
        // 完成，4 个元素需要移动 （4-1）次。

        for (let round = targetElementIndexies.length - 1; round > 0; round--) {
            let targetElementIdx = targetElementIndexies[round];
            let targetElement = lastElements[targetElementIdx];

            container.insertBefore(targetElement, lastElement);
            lastElement = targetElement;
        }
    }

    /**
     * 为新项目对象寻找正确的插入位置。
     *
     * 项目对象从小到大排序，开始位置的项目对象的 “值” 最小，结束位置的最大。
     *
     * @param {*} lastItemObjects
     * @param {*} addItemObject
     * @param {*} conditions
     * @returns 返回插入的位置的索引值，如果新项目的 “值” 比现有的
     *     项目都大，则返回 -1，此时应该将新项目添加到列表末尾。
     */
    static _findPosition(lastItemObjects, addItemObject, conditions) {

        let position = -1; // 默认设置为找不到合适的位置

        if (conditions.length === 0) {
            return position;
        }

        for (let idx = 0; idx < lastItemObjects.length; idx++) {
            // 从小到大排序，开始位置的项目对象的 ”值“ 最小，结束位置的最大，
            // 所以从索引值 0 开始比较，如果新项目对象更小，则新项目插到
            // 当前索引位置上，并退出循环
            let result = ElementSorter._compare(addItemObject, lastItemObjects[idx], conditions);
            if (result < 0) {
                position = idx;
                break;
            }
        }

        return position;
    }

    /**
     * 根据一组条件对象比较两个项目对象。
     *
     * @param {*} leftItemObject
     * @param {*} rightItemObject
     * @param {*} conditions
     * @returns 返回 -1, 0, 1。
     *     - 当左边小于右边时返回 -1
     *     - 当左边等于右边时返回 0
     *     - 当左边大于右边时返回 1
     */
    static _compare(leftItemObject, rightItemObject, conditions) {
        let result = 0;

        for (let { fieldName, isAscendingOrder } of conditions) {
            let fieldResult = ElementSorter._compareField(leftItemObject, rightItemObject, fieldName);

            if (fieldResult === 0) {
                // 分不出高低，所以继续检查下一个条件
            } else {
                if (isAscendingOrder) {
                    result = fieldResult;
                } else {
                    result = -fieldResult;
                }
                break;
            }
        }

        return result;
    }

    /**
     * 比较两个项目对象指定属性（或名称路径 name path）的值的大小
     *
     * @param {*} leftItemObject
     * @param {*} rightItemObject
     * @param {*} namePath
     * @returns 返回 -1, 0, 1。
     *     - 当左边小于右边时返回 -1
     *     - 当左边等于右边时返回 0
     *     - 当左边大于右边时返回 1
     */
    static _compareField(leftItemObject, rightItemObject, namePath) {
        let leftValue = ObjectUtils.getPropertyValueByNamePath(leftItemObject, namePath);
        let rightValue = ObjectUtils.getPropertyValueByNamePath(rightItemObject, namePath);

        if (leftValue === undefined && rightValue === undefined) {
            return 0;
        } else if (leftValue === undefined) {
            return -1;
        } else if (rightValue === undefined) {
            return 1;
        } else if (leftValue === null && rightValue === null) {
            return 0;
        } else if (leftValue === null) {
            return -1;
        } else if (rightValue === null) {
            return 1;
        } else {
            // - Date 对象可以通过 "<" 和 ">" 符号正确比较大小，但无法使用
            //   "==" 或者 "===" 符号判断是否值相等。
            // - 对于 Boolean 类型，true > false
            if (leftValue < rightValue) {
                return -1;
            } else if (leftValue > rightValue) {
                return 1;
            } else {
                return 0;
            }
        }
    }
}

module.exports = ElementSorter;