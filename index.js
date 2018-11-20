/* ========================================================================
*  普通A标签链接或form提交请求转Ajax 
*  使用方法1：<a href="/xxx?attr=val&a2=v2" class="_send_to_ajax">点击后发ajax post请求</a>
*  使用方法2：<b data-action="/xxx" data-ajax-data="attr=val&a2=v2" method="post" class="_send_to_ajax">点击后发ajax post请求</b>
*  使用方法3：<form action="/xxx" method="post" class="_send_to_ajax">submit时截获并改为ajax请求</form>
*  使用方法4：<form action="/xxx" method="post" class="_send_to_ajax" data-reload-delay="1000">submit时截获并改为ajax请求，并且如果提交成功则在1000毫秒后重新加载当前页</form>
*  自定义事件：
*       提交前   submit_before  (return false 将阻止本次请求)
*       提交后   submit_after
*       提交完毕 submit_complete
*       提交成功 submit_success (这里的success 标识error_code == 0，非0会触发submit_error)
*       提交失败 submit_error   (包含HTTP异常和error_code非0的情况)
*
* 另外，被劫持的表单子元素自动支持联动功能（实现表单值变化后UI跟着变），对于不劫持ajax请求的表单，可以$('form').linkageForm()启用联动逻辑：
*   当带有data-is-linkage的元素发生value变化的时候，按当前元素name查找关联元素进行显示隐藏，并对关联元素内的表单进行disabled处理
*   关联示例：
*    <select name="type" data-is-linkage>
*        <option value="">不选</option>
*        <option value="1">类型1</option>
*        <option value="2">类型2</option>
*    </select>
*    当前类型为：<i data-bind="type" />
*    <span data-if-type="1">
*        请填写类型1详情：<input name='type1_desc'>
*    </span>
*    <span data-if-type="2">
*        请填写类型2详情：<input name='type1_desc'>
*    </span>
*    <span data-if-type-empty>
*        请填写不选类型的原因：<input name='type_blll'>
*    </span>
*    <span data-if-type-noempty>
*        请填写选类型的原因：<input name='type_blll'>
*    </span>
*  再另外，如果表单项要启用命名空间（比如服务端期望接受到 json:'{ "input_name":val1 }' 这种数据）
*     可以这么写： <input data-namespace="json" name='input_name'> 理论上支持多维嵌套
*  再另外，可以使用 $('form').backfillForm(data) 进行表单回填（这时候可以在DOM元素上使用data-tmpl属性设置关联JS模板，走JS模板渲染）、使用 $form.resetForm() 进行重置
* ======================================================================== */
(function(){

    function _data_bind_ui($wrap, selector, isShow, isDisabled){
        var $box = $wrap.find(selector);
        $box.each(function(i, bel){
            var $bel = $(bel);
            var act = $bel.data('linkage-act')||'disabled'; //'disabled' || 'readonly', default is 'disabled';
            var isReadOnly = act=='readonly';

            $bel[isReadOnly||isShow?'show':'hide']()
            var $ipt = $bel.find('select,input,textarea');
            if(isDisabled){
                $ipt.attr(act, isDisabled)
            }else{
                $ipt.removeAttr(act);
            }
            $ipt.prop(act, isDisabled).css({ 'pointer-events': isDisabled?'none':'auto' });
        })
    }
    function _is_checkbox_or_radio($el){
        return /(checkbox|radio)/.test($el.attr('type'));
    }

    function submit2ajax(elEvent){

        var tagName = this.tagName;

        //点击FORM时不触发Ajax提交
        if(tagName=='FORM' && elEvent.type=='click'){
            return;
        }

        var $el = $(this);
        
        /* 基于ajax-data-base，动态处理ajax-data内容（在所有自定义事件之前处理，保证业务场景中可通过事件加工数据内容）*/
        var ajaxDataBase = $el.data("ajax-data-base");
        /* 确定data模板是字符串，并且带有待替换的{ids}字样，则认为是批量操作的取列表选择ID行为 */
        if($.isString(ajaxDataBase) && ajaxDataBase.indexOf("{ids}")!=-1){
            var listIframeSelector = $el.data("id-context");
            //全选表单上下文支持当前页内嵌入的iframe
            var idIptContext = listIframeSelector?$(listIframeSelector)[0].contentDocument:document;
            var idsArr = $('._select_item[name="'+__ID_NAME__+'"]:checked',idIptContext).serializeArray();
            
            //整理列表页批量发布所需的ID
            var ids = $.map(idsArr,function(v){ return v.value }).join(",");
            if(ids==''){
                alert("请选择要操作的"+__CONTROL_NAME__+"。");
                return false;
            }
            $el.data("ajax-data",ajaxDataBase.replace(/{ids}/,ids));
        }

        //系统级使用
        var _submitBeforeEvent = $.Event("_submit_before");
        /* 提交前，return false 阻止提交 */
        $el.trigger(_submitBeforeEvent);
        if(_submitBeforeEvent.result==false){
            return false;
        }

        var submitBeforeEvent = $.Event("submit_before");
        /* 提交前，return false 阻止提交 */
        $el.trigger(submitBeforeEvent);
        if(submitBeforeEvent.result==false){
            return false;
        }
        
        //实现类似“确定删除吗”功能
        var confirmText = $el.data("confirm");
        if(confirmText && !confirm(confirmText)){ 
            return false;
        }

        //取得基本数据
        var isLink = tagName=='A',
            url    = $el.data("action") || $el.attr("action") || this.pathname,
            method = $el.data("method") || $el.attr("method") || 'post',
            data   = $el.data("ajax-data") || (isLink?this.search.substr(1):$el.serializeJSON()),
            banJSON2Str = $el.data("ban-json2str"),
            reloadDelay = $el.data("reload-delay")||0,
            banDefAlert = $el.data("prevent-default-alert");

        if(($.isPlainObject(data) || $.isArray(data)) && !banJSON2Str){
            for(var key in data){
                var item = data[key];
                if(($.isPlainObject(item) || $.isArray(item))){
                    data[key] = JSON.stringify(item);
                }
            }
        }

        var _alert = function(res){
            if(!$.alerts){
                $.alerts = {};
            }
            if(!$.alerts.autoLayer){
                $.alerts.autoLayer = window.alert;
            }
            if(!$.alerts.autoLayerError){
                $.alerts.autoLayerError = window.alert;
            }
            $.alerts['autoLayer'+(res.error_code==0?'':'Error')](res.error_msg);
        };

        var ajaxOptions = {
                url: url,
                method: method,
                data: data,
                dataType:'json',
                success:function(resData){
                    if(resData.error_code==0){
                        var submitSuccessEvent = $.Event("submit_success");
                        submitSuccessEvent.req_data = data;
                        submitSuccessEvent.res_data = resData;
                        resData.error_msg = resData.error_msg || '操作成功。';
                        $el.trigger(submitSuccessEvent,resData);
                        if(submitSuccessEvent.result==false){
                            return false;
                        }
                        if(reloadDelay){
                            setTimeout(function(){ location.reload() },reloadDelay);
                        }
                    }else{
                        //业务逻辑异常信息
                        var submitErrorEvent = $.Event("submit_error");
                        submitErrorEvent.req_data = data;
                        submitErrorEvent.res_data = resData;
                        resData.error_msg = resData.error_msg || '未知异常！';
                        $el.trigger(submitErrorEvent,resData);
                        if(submitErrorEvent.result==false){
                            return false;
                        }
                    }
                    // console.log(resData)
                    !banDefAlert && _alert(resData);
                },
                error:function(jqXHR, textStatus, errorThrown){
                    var errData = {
                        error_code:textStatus,
                        error_msg:errorThrown.message,
                        ajaxOptions:ajaxOptions
                    };
                    //业务逻辑异常信息
                    var submitErrorEvent = $.Event("submit_error");
                    submitErrorEvent.req_data = data;
                    submitErrorEvent.res_data = errData;
                    $el.trigger(submitErrorEvent,errData);
                    if(submitErrorEvent.result==false){
                        return false;
                    }
                    !banDefAlert && _alert(errData);
                },
                complete:function(jqXHR, textStatus){
                    $el.trigger("submit_complete",{
                        error_code:textStatus,
                        error_msg:'complete',
                        ajaxOptions:ajaxOptions
                    });
                }
            };

        var  ajax = $.ajax(ajaxOptions);

        $el.trigger("submit_after",ajax);

        return false;
    }

    // 附赠几个表单相关的扩展功能
    $.fn.extend({
        // 格式化表单数据为JSON
        serializeJSON: function(){
            var $from = $(this), ret = {};
            $.each($from.serializeArray(), function(_, item){
                var name = item.name, val = item.value;
                if(ret[name]==undefined){
                    ret[name] = val;
                }else{
                    if($.type(ret[name])=="array"){
                        ret[name].push(val);
                    }else{
                        ret[name] = [ret[name], val];
                    }
                }
            });

            // 对取得的表单数据二次加工
            $.each(ret,function(key, val){

                // 支持在多选框上设置 arr_separator 来指定序列化分隔符
                var sepa = $from.getFieldArrSeparator(key);
                if(!!sepa){
                    ret[key] = $.type(val)=="array"?val.join(sepa):val;
                }

                // 支持通过表单属性声明命名空间
                var _namespace = $from.find('[name="'+key+'"]').data('namespace');
                if(_namespace){
                    delete ret[key];
                    key = _namespace+'.'+key;
                }

                // Namespace to JSON
                var keys = key.split('.'),  maxI = keys.length-1;
                if(maxI){
                    delete ret[key];
                    var child = ret;
                    $.each(keys, function(i, k){
                        child[k] = i!=maxI?(child[k]||{}):val;
                        child = child[k]||{};
                    });
                }
            });
            return ret;
        },

        // 将json数据回填到表单
        backfillForm: function(json){
            var $from = this;
            json = json||{};
            $.each(json,function(key, val){
                // 优先使用res_name别名匹配表单项，以支持服务端数据输出和表单提交字段名不一致的场景
                var $el = $from.find("[data-res_name='"+key+"']");
                if($el.length==0){
                    $el = $from.find("[name='"+key+"']");
                }
                var sepa = $from.getFieldArrSeparator(key, $el);
                var realVal = sepa?(val+'').split(sepa):val;
                // 区别对待单选框和复选框
                if( _is_checkbox_or_radio($el) ){
                    $el.each(function(i, ipt){
                        var $ipt = $(ipt), _val = $ipt.val();
                        $ipt.prop('checked', sepa?$.inArray(_val, realVal)!=-1: (_val == realVal));
                    });
                }else{
                    $el.val(realVal);
                }
                $el.change();
            });

            // 支持模板逻辑回填
            $from.find('[data-tmpl]').each(function(i, dom){
                var $dom = $(dom), 
                    tmplSelector = $dom.data('tmpl'),
                    tmplFun = $dom.data('tmpl-fun'),
                    tmplStr = tmplSelector?$(tmplSelector).html():$dom.html();

                if(!tmplFun){
                    tmplFun = $.tmpl(tmplStr||"[undefined tmpl ('"+tmplSelector+"')]");
                    $dom.data('tmpl-fun', tmplFun);
                }
                $dom.html(tmplFun(json));

            });
            return this;
        },
        /* 为当前选择器命中的wrap子元素添加表单项联动功能（实现表单值变化后UI跟着变）
        * 比如使用 $from.linkageForm() 之后，会对 from 容器内所有带有 data-is-linkage 属性的表单元素增加change侦听
        * 当带有data-is-linkage的元素发生value变化的时候，按当前元素name查找关联元素进行显示隐藏，并对关联元素内的表单进行disabled处理
        * 关联示例：
        *    <select name="type" data-is-linkage>
        *        <option value="">不选</option>
        *        <option value="1">类型1</option>
        *        <option value="2">类型2</option>
        *    </select>
        *    当前类型为：<i data-bind="type" />
        *    <span data-if-type="1">
        *        请填写类型1详情：<input name='type1_desc'>
        *    </span>
        *    <span data-if-type="2">
        *        请填写类型2详情：<input name='type1_desc'>
        *    </span>
        *    <span data-if-type-empty>
        *        请填写不选类型的原因：<input name='type_blll'>
        *    </span>
        *    <span data-if-type-noempty>
        *        请填写选类型的原因：<input name='type_blll'>
        *    </span>
        */
        linkageForm: function(){
            var $wrap = this, is_linkaged = $wrap.data('_is_linkaged');

            if(is_linkaged)return $wrap;
            $wrap.data('_is_linkaged', true);

            // console.log($wrap,'linkageForm')
            // 通过className声明表单项需要具备联动功能
            $wrap.on("change", '[data-is-linkage]', function(){

                // 联动表单发生change事件时，同步更新关联DOM状态
                var $ipt = $(this),
                    name = $ipt.attr('name'), 
                    val = _is_checkbox_or_radio($ipt)?
                        $.makeArray($wrap.find('[name="'+name+'"]:checked').map(function(i, ipt){
                            return $(ipt).val();
                        })).join()
                        :$ipt.val(), 
                    isEmpty = val=="";

                val = (''+val).replace(/"/g,"\\\"");

                // console.log(this.type, name, 'data-is-linkage', val);
                // 展示联动
                $wrap.find('[data-bind="'+name+'"]').text(val);

                // 等于或不等于逻辑联动
                _data_bind_ui($wrap,'[data-if-'+name+'="'+val+'"]', true, false);
                _data_bind_ui($wrap,'[data-if-'+name+'][data-if-'+name+'!="'+val+'"]', false, true);
                
                // 是否为空逻辑联动
                _data_bind_ui($wrap,'[data-if-'+name+'-notempty]', !isEmpty, isEmpty);
                _data_bind_ui($wrap,'[data-if-'+name+'-empty]', isEmpty, !isEmpty);
            });
            return $wrap;
        },
        // 表单重置
        resetForm: function(){
            var _this = this, formEl = _this[0];
            formEl && formEl.reset?formEl.reset():_this.find('form').each(function(i, fEl){ fEl.reset() });
            // 触发联动行为
            _this.find('[data-is-linkage]').change();
            return _this;
        },

        getFieldArrSeparator: function(key, $el){
            return ($el||$(this).find("[name='"+key+"']")).data('arr_separator');
        }
    });

    $(function(){
        var $doc = $(document);
        /* 普通a标签链接转为Ajax.post请求 */
        $doc.on("click submit", "._send_to_ajax", submit2ajax);

        // 自动支持表单联动
        $doc.find("._send_to_ajax").each(function(i, el){ el.tagName=='FORM' && $(el).linkageForm() });
    });
    
})();
